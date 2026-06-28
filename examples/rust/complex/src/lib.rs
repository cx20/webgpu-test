use std::borrow::Cow;
use std::cell::RefCell;
use std::rc::Rc;

use glam::{Mat4, Vec3};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wgpu::util::DeviceExt;
use wgpu::CurrentSurfaceTexture;

mod loader;
use loader::{fetch_bytes, load_model, Model, ModelInfo, MAX_JOINTS};

const MODELS: [ModelInfo; 3] = [
    ModelInfo {
        name: "CesiumMilkTruck",
        scale: 0.4,
        rotation: [0.0, std::f32::consts::FRAC_PI_2, 0.0],
        position: [0.0, 0.0, -2.0],
        url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf",
    },
    ModelInfo {
        name: "Fox",
        scale: 0.05,
        rotation: [0.0, std::f32::consts::FRAC_PI_2, 0.0],
        position: [0.0, 0.0, 0.0],
        url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf",
    },
    ModelInfo {
        name: "Rex",
        scale: 1.0,
        rotation: [0.0, std::f32::consts::FRAC_PI_2, 0.0],
        position: [0.0, 0.0, 3.0],
        url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf",
    },
];

const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth24Plus;

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Uniforms {
    model: [f32; 16],
    view: [f32; 16],
    proj: [f32; 16],
    normal: [f32; 16],
    light_dir: [f32; 4],
    base_color: [f32; 4],
    flags: [u32; 4],
}

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct SkyboxUniforms {
    proj: [f32; 16],
    view: [f32; 16],
}

#[wasm_bindgen(start)]
pub fn start() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console_log::init_with_level(log::Level::Warn).expect("could not initialize logger");
    wasm_bindgen_futures::spawn_local(run());
}

fn request_animation_frame(f: &Closure<dyn FnMut(f64)>) {
    web_sys::window()
        .unwrap()
        .request_animation_frame(f.as_ref().unchecked_ref())
        .expect("requestAnimationFrame failed");
}

struct GroundTrack {
    position_buf: wgpu::Buffer,
    normal_buf: wgpu::Buffer,
    texcoord_buf: wgpu::Buffer,
    joints_buf: wgpu::Buffer,
    weights_buf: wgpu::Buffer,
    index_buf: wgpu::Buffer,
    uniform_buf: wgpu::Buffer,
    bind_group: wgpu::BindGroup,
    color: [f32; 4],
    position: [f32; 3],
}

async fn load_cubemap(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    urls: [&str; 6],
) -> wgpu::TextureView {
    let mut faces = Vec::new();
    let mut size = 0u32;
    for url in urls {
        let bytes = fetch_bytes(url).await;
        let img = image::load_from_memory(&bytes)
            .expect("failed to decode cubemap face")
            .to_rgba8();
        size = img.width();
        faces.push(img.into_raw());
    }

    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("Skybox"),
        size: wgpu::Extent3d {
            width: size,
            height: size,
            depth_or_array_layers: 6,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    for (i, face) in faces.iter().enumerate() {
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d {
                    x: 0,
                    y: 0,
                    z: i as u32,
                },
                aspect: wgpu::TextureAspect::All,
            },
            face,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(4 * size),
                rows_per_image: Some(size),
            },
            wgpu::Extent3d {
                width: size,
                height: size,
                depth_or_array_layers: 1,
            },
        );
    }
    texture.create_view(&wgpu::TextureViewDescriptor {
        dimension: Some(wgpu::TextureViewDimension::Cube),
        ..Default::default()
    })
}

async fn run() {
    let canvas = web_sys::window()
        .unwrap()
        .document()
        .unwrap()
        .get_element_by_id("canvas")
        .expect("an element with id=\"canvas\" is required")
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .unwrap();

    let width = canvas.client_width().max(1) as u32;
    let height = canvas.client_height().max(1) as u32;
    canvas.set_width(width);
    canvas.set_height(height);

    let instance =
        wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle_from_env());
    let surface = instance
        .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
        .expect("Failed to create surface from canvas");

    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::default(),
            force_fallback_adapter: false,
            compatible_surface: Some(&surface),
        })
        .await
        .expect("Failed to find an appropriate adapter");

    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: None,
            required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                .using_resolution(adapter.limits()),
            ..Default::default()
        })
        .await
        .expect("Failed to create device");

    let capabilities = surface.get_capabilities(&adapter);
    let swapchain_format = capabilities.formats[0];
    let config = wgpu::SurfaceConfiguration {
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
        format: swapchain_format,
        width,
        height,
        present_mode: wgpu::PresentMode::Fifo,
        alpha_mode: capabilities.alpha_modes[0],
        view_formats: vec![],
        desired_maximum_frame_latency: 2,
    };
    surface.configure(&device, &config);

    let depth_view = device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some("Depth Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: DEPTH_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        })
        .create_view(&wgpu::TextureViewDescriptor::default());

    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("model"),
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shader.wgsl"))),
    });
    let skybox_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("skybox"),
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("skybox.wgsl"))),
    });

    let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        label: None,
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        mipmap_filter: wgpu::MipmapFilterMode::Linear,
        ..Default::default()
    });

    // Default 1x1 white texture for untextured primitives.
    let default_texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("Default Texture"),
        size: wgpu::Extent3d {
            width: 1,
            height: 1,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture: &default_texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        &[255u8, 255, 255, 255],
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(4),
            rows_per_image: Some(1),
        },
        wgpu::Extent3d {
            width: 1,
            height: 1,
            depth_or_array_layers: 1,
        },
    );
    let default_view = default_texture.create_view(&wgpu::TextureViewDescriptor::default());

    // ===== Main pipeline =====
    let main_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("main"),
        entries: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 1,
                visibility: wgpu::ShaderStages::VERTEX,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Storage { read_only: true },
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 2,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 3,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Texture {
                    sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    view_dimension: wgpu::TextureViewDimension::D2,
                    multisampled: false,
                },
                count: None,
            },
        ],
    });
    let main_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("main"),
        bind_group_layouts: &[Some(&main_bgl)],
        immediate_size: 0,
    });

    let main_vertex_buffers = [
        wgpu::VertexBufferLayout {
            array_stride: 12,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x3,
                offset: 0,
                shader_location: 0,
            }],
        },
        wgpu::VertexBufferLayout {
            array_stride: 12,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x3,
                offset: 0,
                shader_location: 1,
            }],
        },
        wgpu::VertexBufferLayout {
            array_stride: 8,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x2,
                offset: 0,
                shader_location: 2,
            }],
        },
        wgpu::VertexBufferLayout {
            array_stride: 16,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Uint32x4,
                offset: 0,
                shader_location: 3,
            }],
        },
        wgpu::VertexBufferLayout {
            array_stride: 16,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x4,
                offset: 0,
                shader_location: 4,
            }],
        },
    ];

    let main_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some("main"),
        layout: Some(&main_layout),
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: Some("vs_main"),
            buffers: &main_vertex_buffers,
            compilation_options: Default::default(),
        },
        fragment: Some(wgpu::FragmentState {
            module: &shader,
            entry_point: Some("fs_main"),
            targets: &[Some(swapchain_format.into())],
            compilation_options: Default::default(),
        }),
        primitive: wgpu::PrimitiveState {
            topology: wgpu::PrimitiveTopology::TriangleList,
            cull_mode: None,
            ..Default::default()
        },
        depth_stencil: Some(wgpu::DepthStencilState {
            format: DEPTH_FORMAT,
            depth_write_enabled: Some(true),
            depth_compare: Some(wgpu::CompareFunction::Less),
            stencil: wgpu::StencilState::default(),
            bias: wgpu::DepthBiasState::default(),
        }),
        multisample: wgpu::MultisampleState::default(),
        multiview_mask: None,
        cache: None,
    });

    // ===== Skybox pipeline =====
    let skybox_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some("skybox"),
        entries: &[
            wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 1,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                count: None,
            },
            wgpu::BindGroupLayoutEntry {
                binding: 2,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Texture {
                    sample_type: wgpu::TextureSampleType::Float { filterable: true },
                    view_dimension: wgpu::TextureViewDimension::Cube,
                    multisampled: false,
                },
                count: None,
            },
        ],
    });
    let skybox_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: Some("skybox"),
        bind_group_layouts: &[Some(&skybox_bgl)],
        immediate_size: 0,
    });
    let skybox_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some("skybox"),
        layout: Some(&skybox_layout),
        vertex: wgpu::VertexState {
            module: &skybox_shader,
            entry_point: Some("vs_skybox"),
            buffers: &[wgpu::VertexBufferLayout {
                array_stride: 12,
                step_mode: wgpu::VertexStepMode::Vertex,
                attributes: &[wgpu::VertexAttribute {
                    format: wgpu::VertexFormat::Float32x3,
                    offset: 0,
                    shader_location: 0,
                }],
            }],
            compilation_options: Default::default(),
        },
        fragment: Some(wgpu::FragmentState {
            module: &skybox_shader,
            entry_point: Some("fs_skybox"),
            targets: &[Some(swapchain_format.into())],
            compilation_options: Default::default(),
        }),
        primitive: wgpu::PrimitiveState {
            topology: wgpu::PrimitiveTopology::TriangleList,
            ..Default::default()
        },
        depth_stencil: Some(wgpu::DepthStencilState {
            format: DEPTH_FORMAT,
            depth_write_enabled: Some(false),
            depth_compare: Some(wgpu::CompareFunction::LessEqual),
            stencil: wgpu::StencilState::default(),
            bias: wgpu::DepthBiasState::default(),
        }),
        multisample: wgpu::MultisampleState::default(),
        multiview_mask: None,
        cache: None,
    });

    // Skybox geometry (36 vertices).
    #[rustfmt::skip]
    let skybox_vertices: [f32; 108] = [
        -1.0,  1.0, -1.0, -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,  1.0, -1.0, -1.0,  1.0, -1.0,
        -1.0, -1.0,  1.0, -1.0, -1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0, -1.0, -1.0,  1.0,  1.0, -1.0, -1.0,  1.0,
         1.0, -1.0, -1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0, -1.0, -1.0,
        -1.0, -1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0, -1.0, -1.0,  1.0,
        -1.0,  1.0, -1.0,  1.0,  1.0, -1.0,  1.0,  1.0,  1.0,  1.0,  1.0,  1.0, -1.0,  1.0,  1.0, -1.0,  1.0, -1.0,
        -1.0, -1.0, -1.0, -1.0, -1.0,  1.0,  1.0, -1.0, -1.0,  1.0, -1.0, -1.0, -1.0, -1.0,  1.0,  1.0, -1.0,  1.0,
    ];
    let skybox_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("Skybox Buffer"),
        contents: bytemuck::cast_slice(&skybox_vertices),
        usage: wgpu::BufferUsages::VERTEX,
    });
    let skybox_uniform_buf = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Skybox Uniform"),
        size: 128,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    let skybox_path = "https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/";
    let skybox_urls = [
        format!("{skybox_path}px.jpg"),
        format!("{skybox_path}nx.jpg"),
        format!("{skybox_path}py.jpg"),
        format!("{skybox_path}ny.jpg"),
        format!("{skybox_path}pz.jpg"),
        format!("{skybox_path}nz.jpg"),
    ];
    let skybox_view = load_cubemap(
        &device,
        &queue,
        [
            &skybox_urls[0],
            &skybox_urls[1],
            &skybox_urls[2],
            &skybox_urls[3],
            &skybox_urls[4],
            &skybox_urls[5],
        ],
    )
    .await;
    let skybox_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout: &skybox_bgl,
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: skybox_uniform_buf.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::Sampler(&sampler),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::TextureView(&skybox_view),
            },
        ],
    });

    // ===== Load models =====
    let mut models: Vec<Model> = Vec::new();
    let mut scene_min = Vec3::splat(f32::INFINITY);
    let mut scene_max = Vec3::splat(f32::NEG_INFINITY);
    for info in &MODELS {
        log::warn!("loading {}", info.name);
        let model = load_model(&device, &queue, &main_bgl, &sampler, &default_view, info).await;
        model.accumulate_bbox(&mut scene_min, &mut scene_max);
        models.push(model);
    }

    // ===== Ground tracks =====
    let ground_tracks = create_ground_tracks(&device, &main_bgl, &sampler, &default_view);

    // ===== Camera =====
    let center = (scene_min + scene_max) * 0.5;
    let size = scene_max - scene_min;
    let max_size = size.x.max(size.y).max(size.z);
    let camera_distance = max_size * 1.5;

    // requestAnimationFrame render loop. The closure owns all GPU resources and
    // keeps itself alive through the Rc cycle, so nothing is dropped.
    let f = Rc::new(RefCell::new(None));
    let g = f.clone();
    *g.borrow_mut() = Some(Closure::<dyn FnMut(f64)>::new(move |timestamp: f64| {
        let time = (timestamp / 1000.0) as f32;
        let aspect = width as f32 / height as f32;
        let projection = Mat4::perspective_rh(
            std::f32::consts::FRAC_PI_4,
            aspect,
            camera_distance * 0.01,
            camera_distance * 10.0,
        );
        let eye = Vec3::new(
            center.x - (time * 0.5).sin() * camera_distance,
            center.y + camera_distance * 0.3,
            center.z + (time * 0.5).cos() * camera_distance,
        );
        let view = Mat4::look_at_rh(eye, center, Vec3::Y);

        // Update animations / skinning.
        for model in &mut models {
            model.update_animation(time);
            model.update_hierarchy();
            model.update_skins();
        }

        let frame = match surface.get_current_texture() {
            CurrentSurfaceTexture::Success(frame) => frame,
            _ => {
                request_animation_frame(f.borrow().as_ref().unwrap());
                return;
            }
        };
        let target = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder =
            device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });

        // Skybox uniforms (view with translation removed).
        let mut sky_view = view;
        sky_view.w_axis.x = 0.0;
        sky_view.w_axis.y = 0.0;
        sky_view.w_axis.z = 0.0;
        queue.write_buffer(
            &skybox_uniform_buf,
            0,
            bytemuck::bytes_of(&SkyboxUniforms {
                proj: projection.to_cols_array(),
                view: sky_view.to_cols_array(),
            }),
        );

        // Ground track uniforms.
        for ground in &ground_tracks {
            let model = Mat4::from_translation(Vec3::from_array(ground.position));
            let normal = model.inverse().transpose();
            queue.write_buffer(
                &ground.uniform_buf,
                0,
                bytemuck::bytes_of(&Uniforms {
                    model: model.to_cols_array(),
                    view: view.to_cols_array(),
                    proj: projection.to_cols_array(),
                    normal: normal.to_cols_array(),
                    light_dir: [1.0, 1.0, 1.0, 0.0],
                    base_color: ground.color,
                    flags: [0, 0, 1, 0],
                }),
            );
        }

        // Model uniforms + joint matrices.
        for model in &models {
            for node in &model.nodes {
                let Some(mesh_idx) = node.mesh else { continue };
                let mesh = &model.meshes[mesh_idx];
                let mesh_has_skinning = mesh.primitives.iter().any(|p| p.has_skinning);
                let model_mat = if mesh_has_skinning {
                    Mat4::IDENTITY
                } else {
                    node.world
                };
                let normal_mat = model_mat.inverse().transpose();

                for (prim, instance) in mesh.primitives.iter().zip(node.instances.iter()) {
                    let use_skin = prim.has_skinning && node.skin.is_some();
                    queue.write_buffer(
                        &instance.uniform_buf,
                        0,
                        bytemuck::bytes_of(&Uniforms {
                            model: model_mat.to_cols_array(),
                            view: view.to_cols_array(),
                            proj: projection.to_cols_array(),
                            normal: normal_mat.to_cols_array(),
                            light_dir: [1.0, 1.0, 1.0, 0.0],
                            base_color: prim.base_color,
                            flags: [
                                use_skin as u32,
                                prim.has_texture as u32,
                                prim.has_normals as u32,
                                0,
                            ],
                        }),
                    );
                    if use_skin {
                        if let Some(skin_idx) = node.skin {
                            let skin = &model.skins[skin_idx];
                            let n = skin.joint_matrices.len().min(MAX_JOINTS);
                            let mut data = vec![0.0f32; n * 16];
                            for (j, m) in skin.joint_matrices.iter().take(n).enumerate() {
                                data[j * 16..j * 16 + 16].copy_from_slice(&m.to_cols_array());
                            }
                            queue.write_buffer(&instance.joint_buf, 0, bytemuck::cast_slice(&data));
                        }
                    }
                }
            }
        }

        {
            let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &target,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.2,
                            g: 0.2,
                            b: 0.2,
                            a: 1.0,
                        }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &depth_view,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(1.0),
                        store: wgpu::StoreOp::Store,
                    }),
                    stencil_ops: None,
                }),
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });

            // Skybox.
            rpass.set_pipeline(&skybox_pipeline);
            rpass.set_bind_group(0, &skybox_bind_group, &[]);
            rpass.set_vertex_buffer(0, skybox_buf.slice(..));
            rpass.draw(0..36, 0..1);

            // Ground tracks.
            rpass.set_pipeline(&main_pipeline);
            for ground in &ground_tracks {
                rpass.set_bind_group(0, &ground.bind_group, &[]);
                rpass.set_vertex_buffer(0, ground.position_buf.slice(..));
                rpass.set_vertex_buffer(1, ground.normal_buf.slice(..));
                rpass.set_vertex_buffer(2, ground.texcoord_buf.slice(..));
                rpass.set_vertex_buffer(3, ground.joints_buf.slice(..));
                rpass.set_vertex_buffer(4, ground.weights_buf.slice(..));
                rpass.set_index_buffer(ground.index_buf.slice(..), wgpu::IndexFormat::Uint32);
                rpass.draw_indexed(0..6, 0, 0..1);
            }

            // Models.
            for model in &models {
                for node in &model.nodes {
                    let Some(mesh_idx) = node.mesh else { continue };
                    let mesh = &model.meshes[mesh_idx];
                    for (prim, instance) in mesh.primitives.iter().zip(node.instances.iter()) {
                        rpass.set_bind_group(0, &instance.bind_group, &[]);
                        rpass.set_vertex_buffer(0, prim.position_buf.slice(..));
                        rpass.set_vertex_buffer(1, prim.normal_buf.slice(..));
                        rpass.set_vertex_buffer(2, prim.texcoord_buf.slice(..));
                        rpass.set_vertex_buffer(3, prim.joints_buf.slice(..));
                        rpass.set_vertex_buffer(4, prim.weights_buf.slice(..));
                        if let Some(index_buf) = &prim.index_buf {
                            rpass.set_index_buffer(index_buf.slice(..), wgpu::IndexFormat::Uint32);
                            rpass.draw_indexed(0..prim.index_count, 0, 0..1);
                        } else {
                            rpass.draw(0..prim.index_count, 0..1);
                        }
                    }
                }
            }
        }

        queue.submit(Some(encoder.finish()));
        frame.present();
        request_animation_frame(f.borrow().as_ref().unwrap());
    }));

    request_animation_frame(g.borrow().as_ref().unwrap());
}

fn create_ground_tracks(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    sampler: &wgpu::Sampler,
    default_view: &wgpu::TextureView,
) -> Vec<GroundTrack> {
    let positions: [[f32; 3]; 4] = [
        [-50.0, 0.0, 0.0],
        [50.0, 0.0, 0.0],
        [50.0, 0.0, 0.1],
        [-50.0, 0.0, 0.1],
    ];
    let normals: [[f32; 3]; 4] = [[0.0, 1.0, 0.0]; 4];
    let texcoords: [[f32; 2]; 4] = [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]];
    let indices: [u32; 6] = [0, 1, 2, 0, 2, 3];
    let joints: [[u32; 4]; 4] = [[0; 4]; 4];
    let weights: [[f32; 4]; 4] = [[0.0; 4]; 4];

    let positions_data: Vec<[f32; 3]> = positions.to_vec();

    [[-49.5, 0.0, -1.6], [-49.5, 0.0, -2.35]]
        .into_iter()
        .map(|position| {
            let mk = |label: &str, data: &[u8]| {
                device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                    label: Some(label),
                    contents: data,
                    usage: wgpu::BufferUsages::VERTEX,
                })
            };
            let position_buf = mk("Ground Position", bytemuck::cast_slice(&positions_data));
            let normal_buf = mk("Ground Normal", bytemuck::cast_slice(&normals));
            let texcoord_buf = mk("Ground TexCoord", bytemuck::cast_slice(&texcoords));
            let joints_buf = mk("Ground Joints", bytemuck::cast_slice(&joints));
            let weights_buf = mk("Ground Weights", bytemuck::cast_slice(&weights));
            let index_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Ground Index"),
                contents: bytemuck::cast_slice(&indices),
                usage: wgpu::BufferUsages::INDEX,
            });
            let uniform_buf = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Ground Uniform"),
                size: 304,
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            });
            let joint_buf = device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("Ground Joint"),
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
                        resource: wgpu::BindingResource::TextureView(default_view),
                    },
                ],
            });
            GroundTrack {
                position_buf,
                normal_buf,
                texcoord_buf,
                joints_buf,
                weights_buf,
                index_buf,
                uniform_buf,
                bind_group,
                color: [1.0, 1.0, 1.0, 1.0],
                position,
            }
        })
        .collect()
}
