use std::borrow::Cow;
use std::cell::RefCell;
use std::rc::Rc;

use glam::{Mat4, Vec3};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wgpu::util::DeviceExt;
use wgpu::CurrentSurfaceTexture;

// Texture embedded at compile time so the demo needs no extra fetch.
const TEXTURE_BYTES: &[u8] = include_bytes!("../../../../assets/textures/frog.jpg");

// Entry point called automatically once the wasm module is instantiated.
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

fn load_texture(device: &wgpu::Device, queue: &wgpu::Queue) -> wgpu::TextureView {
    let image = image::load_from_memory(TEXTURE_BYTES)
        .expect("failed to decode texture")
        .to_rgba8();
    let (width, height) = image.dimensions();
    let size = wgpu::Extent3d {
        width,
        height,
        depth_or_array_layers: 1,
    };
    let texture = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("Cube Texture"),
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
        &image,
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(4 * width),
            rows_per_image: Some(height),
        },
        size,
    );
    texture.create_view(&wgpu::TextureViewDescriptor::default())
}

async fn run() {
    // Grab the <canvas id="canvas"> declared in index.html.
    let canvas = web_sys::window()
        .unwrap()
        .document()
        .unwrap()
        .get_element_by_id("canvas")
        .expect("an element with id=\"canvas\" is required")
        .dyn_into::<web_sys::HtmlCanvasElement>()
        .unwrap();

    // Match the drawing buffer to the element's CSS size.
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

    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: None,
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shader.wgsl"))),
    });

    // Cube data (see the cube example for the vertex numbering).
    let positions: [[f32; 3]; 24] = [
        // Front face
        [-0.5, -0.5,  0.5], [ 0.5, -0.5,  0.5], [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5],
        // Back face
        [-0.5, -0.5, -0.5], [ 0.5, -0.5, -0.5], [ 0.5,  0.5, -0.5], [-0.5,  0.5, -0.5],
        // Top face
        [ 0.5,  0.5,  0.5], [-0.5,  0.5,  0.5], [-0.5,  0.5, -0.5], [ 0.5,  0.5, -0.5],
        // Bottom face
        [-0.5, -0.5,  0.5], [ 0.5, -0.5,  0.5], [ 0.5, -0.5, -0.5], [-0.5, -0.5, -0.5],
        // Right face
        [ 0.5, -0.5,  0.5], [ 0.5,  0.5,  0.5], [ 0.5,  0.5, -0.5], [ 0.5, -0.5, -0.5],
        // Left face
        [-0.5, -0.5,  0.5], [-0.5,  0.5,  0.5], [-0.5,  0.5, -0.5], [-0.5, -0.5, -0.5],
    ];
    let tex_coords: [[f32; 2]; 24] = [
        // Front face
        [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0],
        // Back face
        [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0],
        // Top face
        [0.0, 1.0], [0.0, 0.0], [1.0, 0.0], [1.0, 1.0],
        // Bottom face
        [1.0, 1.0], [0.0, 1.0], [0.0, 0.0], [1.0, 0.0],
        // Right face
        [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0],
        // Left face
        [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0],
    ];
    let indices: [u32; 36] = [
         0,  1,  2,    0,  2,  3, // Front face
         4,  5,  6,    4,  6,  7, // Back face
         8,  9, 10,    8, 10, 11, // Top face
        12, 13, 14,   12, 14, 15, // Bottom face
        16, 17, 18,   16, 18, 19, // Right face
        20, 21, 22,   20, 22, 23, // Left face
    ];

    let vertex_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("Vertex Buffer"),
        contents: bytemuck::cast_slice(&positions),
        usage: wgpu::BufferUsages::VERTEX,
    });
    let coord_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("TexCoord Buffer"),
        contents: bytemuck::cast_slice(&tex_coords),
        usage: wgpu::BufferUsages::VERTEX,
    });
    let index_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("Index Buffer"),
        contents: bytemuck::cast_slice(&indices),
        usage: wgpu::BufferUsages::INDEX,
    });
    let index_count = indices.len() as u32;

    let vertex_buffers = [
        wgpu::VertexBufferLayout {
            array_stride: 3 * 4,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x3,
                offset: 0,
                shader_location: 0,
            }],
        },
        wgpu::VertexBufferLayout {
            array_stride: 2 * 4,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &[wgpu::VertexAttribute {
                format: wgpu::VertexFormat::Float32x2,
                offset: 0,
                shader_location: 1,
            }],
        },
    ];

    let capabilities = surface.get_capabilities(&adapter);
    let swapchain_format = capabilities.formats[0];
    const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth24Plus;

    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: None,
        layout: None,
        vertex: wgpu::VertexState {
            module: &shader,
            entry_point: Some("vs_main"),
            buffers: &vertex_buffers,
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

    let uniform_buf = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("Uniform Buffer"),
        size: 64, // one 4x4 f32 matrix
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });

    let texture_view = load_texture(&device, &queue);
    let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
        label: None,
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        ..Default::default()
    });

    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout: &render_pipeline.get_bind_group_layout(0),
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buf.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: wgpu::BindingResource::Sampler(&sampler),
            },
            wgpu::BindGroupEntry {
                binding: 2,
                resource: wgpu::BindingResource::TextureView(&texture_view),
            },
        ],
    });

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

    let aspect = width as f32 / height as f32;
    let projection = Mat4::perspective_rh(45f32.to_radians(), aspect, 0.1, 100.0);

    // requestAnimationFrame render loop. The closure owns all GPU resources and
    // keeps itself alive through the Rc cycle, so nothing is dropped.
    let f = Rc::new(RefCell::new(None));
    let g = f.clone();
    *g.borrow_mut() = Some(Closure::<dyn FnMut(f64)>::new(move |timestamp: f64| {
        let rad = (timestamp / 1000.0) as f32;
        let view = Mat4::from_translation(Vec3::new(0.0, 0.0, -3.0))
            * Mat4::from_axis_angle(Vec3::new(1.0, 1.0, 1.0).normalize(), rad);
        let mvp = projection * view;
        queue.write_buffer(&uniform_buf, 0, bytemuck::cast_slice(&mvp.to_cols_array()));

        let frame = match surface.get_current_texture() {
            CurrentSurfaceTexture::Success(frame) => frame,
            _ => {
                request_animation_frame(f.borrow().as_ref().unwrap());
                return;
            }
        };
        let view_tex = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder =
            device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
        {
            let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: None,
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view_tex,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
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
            rpass.set_pipeline(&render_pipeline);
            rpass.set_bind_group(0, &bind_group, &[]);
            rpass.set_vertex_buffer(0, vertex_buf.slice(..));
            rpass.set_vertex_buffer(1, coord_buf.slice(..));
            rpass.set_index_buffer(index_buf.slice(..), wgpu::IndexFormat::Uint32);
            rpass.draw_indexed(0..index_count, 0, 0..1);
        }
        queue.submit(Some(encoder.finish()));
        frame.present();

        request_animation_frame(f.borrow().as_ref().unwrap());
    }));

    request_animation_frame(g.borrow().as_ref().unwrap());
}
