use std::borrow::Cow;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use wgpu::util::DeviceExt;
use wgpu::CurrentSurfaceTexture;

// Entry point called automatically once the wasm module is instantiated.
#[wasm_bindgen(start)]
pub fn start() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console_log::init_with_level(log::Level::Warn).expect("could not initialize logger");
    wasm_bindgen_futures::spawn_local(run());
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
            // Request an adapter which can render to our surface
            compatible_surface: Some(&surface),
        })
        .await
        .expect("Failed to find an appropriate adapter");

    // Create the logical device and command queue
    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor {
            label: None,
            // Make sure we use the texture resolution limits from the adapter, so we can
            // support images the size of the swapchain.
            required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                .using_resolution(adapter.limits()),
            ..Default::default()
        })
        .await
        .expect("Failed to create device");

    // Load the shaders from disk
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: None,
        source: wgpu::ShaderSource::Wgsl(Cow::Borrowed(include_str!("shader.wgsl"))),
    });

    let vertex_data: [[f32; 3]; 3] = [
        [ 0.0,  0.5, 0.0],
        [-0.5, -0.5, 0.0],
        [ 0.5, -0.5, 0.0],
    ];

    let vertex_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("Vertex Buffer"),
        contents: bytemuck::cast_slice(&vertex_data),
        usage: wgpu::BufferUsages::VERTEX,
    });

    let vertex_buffers = [wgpu::VertexBufferLayout {
        array_stride: 3 * 4,
        step_mode: wgpu::VertexStepMode::Vertex,
        attributes: &[wgpu::VertexAttribute {
            format: wgpu::VertexFormat::Float32x3,
            offset: 0,
            shader_location: 0,
        }],
    }];

    let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
        label: None,
        bind_group_layouts: &[],
        immediate_size: 0,
    });

    let capabilities = surface.get_capabilities(&adapter);
    let swapchain_format = capabilities.formats[0];

    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: None,
        layout: Some(&pipeline_layout),
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
        depth_stencil: None,
        multisample: wgpu::MultisampleState::default(),
        multiview_mask: None,
        cache: None,
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

    // The scene is static, so a single frame is enough.
    let frame = match surface.get_current_texture() {
        CurrentSurfaceTexture::Success(frame) => frame,
        _ => {
            log::error!("Failed to acquire next swap chain texture");
            return;
        }
    };
    let view = frame
        .texture
        .create_view(&wgpu::TextureViewDescriptor::default());
    let mut encoder =
        device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
    {
        let mut rpass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: None,
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &view,
                depth_slice: None,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        rpass.set_pipeline(&render_pipeline);
        rpass.set_vertex_buffer(0, vertex_buf.slice(..));
        rpass.draw(0..3, 0..1);
    }

    queue.submit(Some(encoder.finish()));
    frame.present();

    // Keep the GPU resources alive so the presented frame stays on the canvas.
    std::mem::forget((instance, adapter, device, queue, surface, render_pipeline, vertex_buf));
}
