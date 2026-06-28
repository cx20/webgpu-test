//! Minimal glTF loader for the web: fetches the document, its buffers and
//! textures with `fetch`, builds GPU resources, and provides per-frame
//! animation / skinning / hierarchy updates.

use glam::{Mat4, Quat, Vec3};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;
use wgpu::util::DeviceExt;

pub const MAX_JOINTS: usize = 180;

pub struct ModelInfo {
    pub name: &'static str,
    pub scale: f32,
    pub rotation: [f32; 3],
    pub position: [f32; 3],
    pub url: &'static str,
}

pub struct Primitive {
    pub position_buf: wgpu::Buffer,
    pub normal_buf: wgpu::Buffer,
    pub texcoord_buf: wgpu::Buffer,
    pub joints_buf: wgpu::Buffer,
    pub weights_buf: wgpu::Buffer,
    pub index_buf: Option<wgpu::Buffer>,
    pub index_count: u32,
    pub texture_view: wgpu::TextureView,
    pub base_color: [f32; 4],
    pub has_texture: bool,
    pub has_skinning: bool,
    pub has_normals: bool,
    pub bbox_min: Vec3,
    pub bbox_max: Vec3,
}

pub struct Mesh {
    pub primitives: Vec<Primitive>,
}

pub struct PrimitiveInstance {
    pub uniform_buf: wgpu::Buffer,
    pub joint_buf: wgpu::Buffer,
    pub bind_group: wgpu::BindGroup,
}

pub struct Node {
    pub translation: Vec3,
    pub rotation: Quat,
    pub scale: Vec3,
    pub local: Mat4,
    pub world: Mat4,
    pub mesh: Option<usize>,
    pub skin: Option<usize>,
    pub children: Vec<usize>,
    pub has_matrix: bool,
    pub instances: Vec<PrimitiveInstance>,
}

pub struct Skin {
    pub joints: Vec<usize>,
    pub inverse_bind: Vec<Mat4>,
    pub joint_matrices: Vec<Mat4>,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Path {
    Translation,
    Rotation,
    Scale,
}

pub struct Channel {
    pub node: usize,
    pub path: Path,
    pub times: Vec<f32>,
    pub values: Vec<f32>,
}

pub struct Animation {
    pub channels: Vec<Channel>,
    pub duration: f32,
}

pub struct Model {
    pub nodes: Vec<Node>,
    pub meshes: Vec<Mesh>,
    pub skins: Vec<Skin>,
    pub animation: Option<Animation>,
    pub root_nodes: Vec<usize>,
    pub base_transform: Mat4,
}

// ========== Fetch helpers ==========

pub async fn fetch_bytes(url: &str) -> Vec<u8> {
    let window = web_sys::window().unwrap();
    let resp_value = JsFuture::from(window.fetch_with_str(url))
        .await
        .unwrap_or_else(|_| panic!("fetch failed: {url}"));
    let resp: web_sys::Response = resp_value.dyn_into().unwrap();
    let buf = JsFuture::from(resp.array_buffer().unwrap()).await.unwrap();
    js_sys::Uint8Array::new(&buf).to_vec()
}

fn base64_decode(s: &str) -> Vec<u8> {
    fn val(c: u8) -> i32 {
        match c {
            b'A'..=b'Z' => (c - b'A') as i32,
            b'a'..=b'z' => (c - b'a' + 26) as i32,
            b'0'..=b'9' => (c - b'0' + 52) as i32,
            b'+' => 62,
            b'/' => 63,
            _ => -1,
        }
    }
    let mut out = Vec::new();
    let mut buf = 0i32;
    let mut bits = 0;
    for &c in s.as_bytes() {
        let v = val(c);
        if v < 0 {
            continue;
        }
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
        }
    }
    out
}

/// Resolves a glTF `uri` to bytes, handling both `data:` URIs and relative URLs.
async fn resolve_uri(base_url: &str, uri: &str) -> Vec<u8> {
    if let Some(comma) = uri.strip_prefix("data:").and_then(|_| uri.find(',')) {
        return base64_decode(&uri[comma + 1..]);
    }
    fetch_bytes(&format!("{base_url}{uri}")).await
}

// ========== Loading ==========

fn decode_image(bytes: &[u8]) -> (Vec<u8>, u32, u32) {
    let img = image::load_from_memory(bytes)
        .expect("failed to decode image")
        .to_rgba8();
    let (w, h) = img.dimensions();
    (img.into_raw(), w, h)
}

fn upload_texture(device: &wgpu::Device, queue: &wgpu::Queue, rgba: &[u8], w: u32, h: u32) -> wgpu::TextureView {
    let size = wgpu::Extent3d {
        width: w,
        height: h,
        depth_or_array_layers: 1,
    };
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("glTF Texture"),
        size,
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture: &texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        rgba,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(4 * w),
            rows_per_image: Some(h),
        },
        size,
    );
    texture.create_view(&wgpu::TextureViewDescriptor::default())
}

#[allow(clippy::too_many_arguments)]
pub async fn load_model(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    layout: &wgpu::BindGroupLayout,
    sampler: &wgpu::Sampler,
    default_view: &wgpu::TextureView,
    info: &ModelInfo,
) -> Model {
    let bytes = fetch_bytes(info.url).await;
    let base_url = &info.url[..=info.url.rfind('/').unwrap()];
    let gltf = gltf::Gltf::from_slice(&bytes).expect("failed to parse glTF");
    let document = &gltf.document;

    // Resolve buffers.
    let mut buffers: Vec<Vec<u8>> = Vec::new();
    for buffer in document.buffers() {
        match buffer.source() {
            gltf::buffer::Source::Uri(uri) => buffers.push(resolve_uri(base_url, uri).await),
            gltf::buffer::Source::Bin => {
                buffers.push(gltf.blob.clone().expect("missing GLB binary chunk"))
            }
        }
    }
    let buf_slices: Vec<&[u8]> = buffers.iter().map(|b| b.as_slice()).collect();

    // Resolve textures (cached by image source index).
    let mut texture_cache: std::collections::HashMap<usize, wgpu::TextureView> =
        std::collections::HashMap::new();
    for tex in document.textures() {
        let image = tex.source();
        let idx = image.index();
        if texture_cache.contains_key(&idx) {
            continue;
        }
        let (rgba, w, h) = match image.source() {
            gltf::image::Source::Uri { uri, .. } => {
                let data = resolve_uri(base_url, uri).await;
                decode_image(&data)
            }
            gltf::image::Source::View { view, .. } => {
                let start = view.offset();
                let end = start + view.length();
                decode_image(&buf_slices[view.buffer().index()][start..end])
            }
        };
        texture_cache.insert(idx, upload_texture(device, queue, &rgba, w, h));
    }

    // Build meshes.
    let mut meshes: Vec<Mesh> = Vec::new();
    for mesh in document.meshes() {
        let mut primitives = Vec::new();
        for primitive in mesh.primitives() {
            let reader = primitive.reader(|b| Some(buf_slices[b.index()]));

            let positions: Vec<[f32; 3]> = reader
                .read_positions()
                .expect("primitive without POSITION")
                .collect();
            let vertex_count = positions.len();

            let has_normals = reader.read_normals().is_some();
            let normals: Vec<[f32; 3]> = match reader.read_normals() {
                Some(n) => n.collect(),
                None => vec![[0.0, 1.0, 0.0]; vertex_count],
            };
            let texcoords: Vec<[f32; 2]> = match reader.read_tex_coords(0) {
                Some(t) => t.into_f32().collect(),
                None => vec![[0.0, 0.0]; vertex_count],
            };
            let has_joints = reader.read_joints(0).is_some();
            let joints: Vec<[u32; 4]> = match reader.read_joints(0) {
                Some(j) => j.into_u16().map(|v| [v[0] as u32, v[1] as u32, v[2] as u32, v[3] as u32]).collect(),
                None => vec![[0, 0, 0, 0]; vertex_count],
            };
            let has_weights = reader.read_weights(0).is_some();
            let weights: Vec<[f32; 4]> = match reader.read_weights(0) {
                Some(w) => w.into_f32().collect(),
                None => vec![[1.0, 0.0, 0.0, 0.0]; vertex_count],
            };
            let indices: Option<Vec<u32>> = reader.read_indices().map(|i| i.into_u32().collect());

            // Bounding box.
            let mut bbox_min = Vec3::splat(f32::INFINITY);
            let mut bbox_max = Vec3::splat(f32::NEG_INFINITY);
            for p in &positions {
                let v = Vec3::from_array(*p);
                bbox_min = bbox_min.min(v);
                bbox_max = bbox_max.max(v);
            }

            // Material.
            let mut texture_view: Option<wgpu::TextureView> = None;
            let pbr = primitive.material().pbr_metallic_roughness();
            let base_color = pbr.base_color_factor();
            if let Some(info) = pbr.base_color_texture() {
                let img_idx = info.texture().source().index();
                texture_view = texture_cache.get(&img_idx).map(|v| v.clone());
            }
            let has_texture = texture_view.is_some();

            let make_vbuf = |label: &str, data: &[u8]| {
                device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some(label),
                    contents: data,
                    usage: wgpu::BufferUsages::VERTEX,
                })
            };

            let index_buf = indices.as_ref().map(|idx| {
                device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some("Index Buffer"),
                    contents: bytemuck::cast_slice(idx),
                    usage: wgpu::BufferUsages::INDEX,
                })
            });
            let index_count = match &indices {
                Some(idx) => idx.len() as u32,
                None => vertex_count as u32,
            };

            primitives.push(Primitive {
                position_buf: make_vbuf("Position", bytemuck::cast_slice(&positions)),
                normal_buf: make_vbuf("Normal", bytemuck::cast_slice(&normals)),
                texcoord_buf: make_vbuf("TexCoord", bytemuck::cast_slice(&texcoords)),
                joints_buf: make_vbuf("Joints", bytemuck::cast_slice(&joints)),
                weights_buf: make_vbuf("Weights", bytemuck::cast_slice(&weights)),
                index_buf,
                index_count,
                texture_view: texture_view.unwrap_or_else(|| default_view.clone()),
                base_color,
                has_texture,
                has_skinning: has_joints && has_weights,
                has_normals,
                bbox_min,
                bbox_max,
            });
        }
        meshes.push(Mesh { primitives });
    }

    // Build nodes.
    let mut nodes: Vec<Node> = document
        .nodes()
        .map(|node| {
            let (translation, rotation, scale, has_matrix, local) = match node.transform() {
                gltf::scene::Transform::Matrix { matrix } => {
                    let m = Mat4::from_cols_array_2d(&matrix);
                    let (s, r, t) = m.to_scale_rotation_translation();
                    (t, r, s, true, m)
                }
                gltf::scene::Transform::Decomposed {
                    translation,
                    rotation,
                    scale,
                } => {
                    let t = Vec3::from_array(translation);
                    let r = Quat::from_array(rotation);
                    let s = Vec3::from_array(scale);
                    (t, r, s, false, Mat4::from_scale_rotation_translation(s, r, t))
                }
            };
            Node {
                translation,
                rotation,
                scale,
                local,
                world: Mat4::IDENTITY,
                mesh: node.mesh().map(|m| m.index()),
                skin: node.skin().map(|s| s.index()),
                children: node.children().map(|c| c.index()).collect(),
                has_matrix,
                instances: Vec::new(),
            }
        })
        .collect();

    // Per-node primitive instances (so nodes sharing a mesh get distinct transforms).
    for i in 0..nodes.len() {
        if let Some(mesh_idx) = nodes[i].mesh {
            let mut instances = Vec::new();
            for prim in &meshes[mesh_idx].primitives {
                let uniform_buf = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Uniform Buffer"),
                    size: 304,
                    usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                let joint_buf = device.create_buffer(&wgpu::BufferDescriptor {
                    label: Some("Joint Buffer"),
                    size: (MAX_JOINTS * 64) as u64,
                    usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
                    mapped_at_creation: false,
                });
                let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: None,
                    layout,
                    entries: &[
                        wgpu::BindGroupEntry {
                            binding: 0,
                            resource: uniform_buf.as_entire_binding(),
                        },
                        wgpu::BindGroupEntry {
                            binding: 1,
                            resource: joint_buf.as_entire_binding(),
                        },
                        wgpu::BindGroupEntry {
                            binding: 2,
                            resource: wgpu::BindingResource::Sampler(sampler),
                        },
                        wgpu::BindGroupEntry {
                            binding: 3,
                            resource: wgpu::BindingResource::TextureView(&prim.texture_view),
                        },
                    ],
                });
                instances.push(PrimitiveInstance {
                    uniform_buf,
                    joint_buf,
                    bind_group,
                });
            }
            nodes[i].instances = instances;
        }
    }

    // Skins.
    let skins: Vec<Skin> = document
        .skins()
        .map(|skin| {
            let reader = skin.reader(|b| Some(buf_slices[b.index()]));
            let joints: Vec<usize> = skin.joints().map(|j| j.index()).collect();
            let inverse_bind: Vec<Mat4> = match reader.read_inverse_bind_matrices() {
                Some(it) => it.map(|m| Mat4::from_cols_array_2d(&m)).collect(),
                None => vec![Mat4::IDENTITY; joints.len()],
            };
            let joint_matrices = vec![Mat4::IDENTITY; joints.len()];
            Skin {
                joints,
                inverse_bind,
                joint_matrices,
            }
        })
        .collect();

    // Animation (Fox uses "Run", everything else the first clip).
    let animation = load_animation(document, &buf_slices, info.name == "Fox");

    // Base transform: T * Ry * Rx * Rz * S
    let base_transform = Mat4::from_translation(Vec3::from_array(info.position))
        * Mat4::from_rotation_y(info.rotation[1])
        * Mat4::from_rotation_x(info.rotation[0])
        * Mat4::from_rotation_z(info.rotation[2])
        * Mat4::from_scale(Vec3::splat(info.scale));

    let scene = document.default_scene().or_else(|| document.scenes().next()).unwrap();
    let root_nodes: Vec<usize> = scene.nodes().map(|n| n.index()).collect();

    Model {
        nodes,
        meshes,
        skins,
        animation,
        root_nodes,
        base_transform,
    }
}

fn load_animation(
    document: &gltf::Document,
    buffers: &[&[u8]],
    is_fox: bool,
) -> Option<Animation> {
    let mut chosen: Option<gltf::Animation> = None;
    for anim in document.animations() {
        if is_fox && anim.name() == Some("Run") {
            chosen = Some(anim);
            break;
        }
        if chosen.is_none() {
            chosen = Some(anim);
        }
    }
    let anim = chosen?;

    let mut channels = Vec::new();
    let mut duration = 0.0f32;
    for channel in anim.channels() {
        let reader = channel.reader(|b| Some(buffers[b.index()]));
        let times: Vec<f32> = reader.read_inputs().map(|i| i.collect()).unwrap_or_default();
        if let Some(last) = times.last() {
            duration = duration.max(*last);
        }
        let (path, values): (Path, Vec<f32>) = match reader.read_outputs() {
            Some(gltf::animation::util::ReadOutputs::Translations(it)) => {
                (Path::Translation, it.flatten().collect())
            }
            Some(gltf::animation::util::ReadOutputs::Rotations(rot)) => {
                (Path::Rotation, rot.into_f32().flatten().collect())
            }
            Some(gltf::animation::util::ReadOutputs::Scales(it)) => {
                (Path::Scale, it.flatten().collect())
            }
            _ => continue,
        };
        channels.push(Channel {
            node: channel.target().node().index(),
            path,
            times,
            values,
        });
    }
    Some(Animation { channels, duration })
}

// ========== Per-frame updates ==========

impl Model {
    pub fn update_animation(&mut self, time: f32) {
        let Some(anim) = &self.animation else {
            return;
        };
        if anim.duration <= 0.0 {
            return;
        }
        let t = time % anim.duration;
        for channel in &anim.channels {
            let times = &channel.times;
            if times.is_empty() {
                continue;
            }
            let (prev, next) = if t <= times[0] {
                (0, 0)
            } else if t >= times[times.len() - 1] {
                (times.len() - 1, times.len() - 1)
            } else {
                let mut pair = (0, 0);
                for i in 0..times.len() - 1 {
                    if t >= times[i] && t < times[i + 1] {
                        pair = (i, i + 1);
                        break;
                    }
                }
                pair
            };
            let factor = if prev != next {
                (t - times[prev]) / (times[next] - times[prev])
            } else {
                0.0
            };
            let node = &mut self.nodes[channel.node];
            let v = &channel.values;
            match channel.path {
                Path::Rotation => {
                    let a = Quat::from_slice(&v[prev * 4..prev * 4 + 4]);
                    let b = Quat::from_slice(&v[next * 4..next * 4 + 4]);
                    node.rotation = a.slerp(b, factor);
                }
                Path::Translation => {
                    let a = Vec3::from_slice(&v[prev * 3..prev * 3 + 3]);
                    let b = Vec3::from_slice(&v[next * 3..next * 3 + 3]);
                    node.translation = a.lerp(b, factor);
                }
                Path::Scale => {
                    let a = Vec3::from_slice(&v[prev * 3..prev * 3 + 3]);
                    let b = Vec3::from_slice(&v[next * 3..next * 3 + 3]);
                    node.scale = a.lerp(b, factor);
                }
            }
        }
    }

    pub fn update_hierarchy(&mut self) {
        let animated = self.animation.is_some();
        let roots = self.root_nodes.clone();
        let base = self.base_transform;
        for root in roots {
            self.update_node(root, base, animated);
        }
    }

    fn update_node(&mut self, idx: usize, parent: Mat4, animated: bool) {
        let local = {
            let node = &self.nodes[idx];
            if node.has_matrix && !animated {
                node.local
            } else {
                Mat4::from_scale_rotation_translation(node.scale, node.rotation, node.translation)
            }
        };
        let world = parent * local;
        self.nodes[idx].world = world;
        let children = self.nodes[idx].children.clone();
        for child in children {
            self.update_node(child, world, animated);
        }
    }

    pub fn update_skins(&mut self) {
        for skin in &mut self.skins {
            for (i, &joint) in skin.joints.iter().enumerate() {
                skin.joint_matrices[i] = self.nodes[joint].world * skin.inverse_bind[i];
            }
        }
    }

    /// Accumulates the model's (bind-pose) world-space bounding box.
    pub fn accumulate_bbox(&self, min: &mut Vec3, max: &mut Vec3) {
        let roots = self.root_nodes.clone();
        for root in roots {
            self.bbox_node(root, self.base_transform, min, max);
        }
    }

    fn bbox_node(&self, idx: usize, parent: Mat4, min: &mut Vec3, max: &mut Vec3) {
        let node = &self.nodes[idx];
        let local =
            Mat4::from_scale_rotation_translation(node.scale, node.rotation, node.translation);
        let world = parent * local;
        if let Some(mesh_idx) = node.mesh {
            for prim in &self.meshes[mesh_idx].primitives {
                let (lo, hi) = (prim.bbox_min, prim.bbox_max);
                let corners = [
                    Vec3::new(lo.x, lo.y, lo.z),
                    Vec3::new(hi.x, lo.y, lo.z),
                    Vec3::new(lo.x, hi.y, lo.z),
                    Vec3::new(hi.x, hi.y, lo.z),
                    Vec3::new(lo.x, lo.y, hi.z),
                    Vec3::new(hi.x, lo.y, hi.z),
                    Vec3::new(lo.x, hi.y, hi.z),
                    Vec3::new(hi.x, hi.y, hi.z),
                ];
                for c in corners {
                    let t = world.transform_point3(c);
                    *min = min.min(t);
                    *max = max.max(t);
                }
            }
        }
        for &child in &node.children {
            self.bbox_node(child, world, min, max);
        }
    }
}
