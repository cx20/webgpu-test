// forked from https://github.com/cwoffenden/hello-webgpu

#include <stdio.h>
#include <string.h>
#include <webgpu/webgpu.h>
#include <emscripten/html5.h>
#include <emscripten/em_js.h>

namespace window {
	typedef struct HandleImpl* Handle;
	typedef bool (*Redraw) ();
	Handle _Nullable create(unsigned winW = 0, unsigned winH = 0, const char* _Nullable name = nullptr);
	void destroy(Handle _Nonnull wHnd);
	void show(Handle _Nonnull wHnd, bool show = true);
	void loop(Handle _Nonnull wHnd, Redraw _Nullable func = nullptr);
}

namespace webgpu {
	void createSurface(WGPUDevice device);
	WGPUTextureFormat getSurfaceFormat();
}

namespace window {
	/**
	 * Temporary dummy window handle.
	 */
	struct HandleImpl {} DUMMY;

	EM_BOOL em_redraw(double /*time*/, void *userData) {
		window::Redraw redraw = (window::Redraw)userData;
		return redraw(); // If this returns true, rAF() will continue, otherwise it will terminate
	}
}

window::Handle window::create(unsigned /*winW*/, unsigned /*winH*/, const char* /*name*/) {
	return &DUMMY;
}

void window::destroy(window::Handle /*wHnd*/) {}

void window::show(window::Handle /*wHnd*/, bool /*show*/) {}

void window::loop(window::Handle /*wHnd*/, window::Redraw func) {
	emscripten_request_animation_frame_loop(window::em_redraw, (void*)func);
}

WGPUInstance instance;
WGPUDevice device;
WGPUQueue queue;
WGPUSurface surface;

// On the web the preferred canvas format is typically BGRA8Unorm.
WGPUTextureFormat surfaceFormat = WGPUTextureFormat_BGRA8Unorm;

WGPURenderPipeline pipeline;
WGPUBuffer vertexBuffer; // vertex buffer with position
WGPUBuffer colorBuffer;  // vertex buffer with colours

// Query the current drawing-buffer size (the full browser window).
EM_JS(int, canvas_get_width,  (), { return window.innerWidth;  });
EM_JS(int, canvas_get_height, (), { return window.innerHeight; });

uint32_t curW = 0;
uint32_t curH = 0;

void configureSurface(uint32_t w, uint32_t h) {
	WGPUSurfaceConfiguration config = {};
	config.device      = device;
	config.format      = surfaceFormat;
	config.usage       = WGPUTextureUsage_RenderAttachment;
	config.width       = w;
	config.height      = h;
	config.alphaMode   = WGPUCompositeAlphaMode_Auto;
	config.presentMode = WGPUPresentMode_Fifo;
	wgpuSurfaceConfigure(surface, &config);
	curW = w;
	curH = h;
}

void webgpu::createSurface(WGPUDevice /*device*/) {
	WGPUEmscriptenSurfaceSourceCanvasHTMLSelector canvasDesc = {};
	canvasDesc.chain.sType = WGPUSType_EmscriptenSurfaceSourceCanvasHTMLSelector;
	canvasDesc.selector = { "canvas", WGPU_STRLEN };

	WGPUSurfaceDescriptor surfDesc = {};
	surfDesc.nextInChain = &canvasDesc.chain;

	surface = wgpuInstanceCreateSurface(instance, &surfDesc);

	configureSurface((uint32_t)canvas_get_width(), (uint32_t)canvas_get_height());
}

WGPUTextureFormat webgpu::getSurfaceFormat() {
	return surfaceFormat;
}

WGPUShaderModule createShader(const char* const code, const char* label = nullptr) {
	WGPUShaderSourceWGSL wgsl = {};
	wgsl.chain.sType = WGPUSType_ShaderSourceWGSL;
	wgsl.code = { code, WGPU_STRLEN };
	WGPUShaderModuleDescriptor desc = {};
	desc.nextInChain = &wgsl.chain;
	if (label) {
		desc.label = { label, WGPU_STRLEN };
	}
	return wgpuDeviceCreateShaderModule(device, &desc);
}

WGPUBuffer createBuffer(const void* data, size_t size, WGPUBufferUsage usage) {
	WGPUBufferDescriptor desc = {};
	desc.usage = WGPUBufferUsage_CopyDst | usage;
	desc.size  = size;
	WGPUBuffer buffer = wgpuDeviceCreateBuffer(device, &desc);
	wgpuQueueWriteBuffer(queue, buffer, 0, data, size);
	return buffer;
}

char const triangle_vert_wgsl[] = R"(
	struct VertexOutput {
	    @builtin(position) Position : vec4<f32>,
	    @location(0) fragColor : vec4<f32>
	}

	@vertex
	fn main(
	    @location(0) position : vec3<f32>,
	    @location(1) color : vec4<f32>
	) -> VertexOutput {
	    var output : VertexOutput;
	    output.fragColor = color;
	    output.Position = vec4<f32>(position, 1.0);
	    return output;
	}
)";

char const triangle_frag_wgsl[] = R"(
	@fragment
	fn main(
	    @location(0) fragColor : vec4<f32>
	) -> @location(0) vec4<f32> {
	    return fragColor;
	}
)";

void createPipelineAndBuffers() {
	WGPUShaderModule vertMod = createShader(triangle_vert_wgsl);
	WGPUShaderModule fragMod = createShader(triangle_frag_wgsl);

	WGPUPipelineLayoutDescriptor layoutDesc = {};
	WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(device, &layoutDesc);

	// describe buffer layouts
	WGPUVertexAttribute vertAttrs1 = {};
	vertAttrs1.format = WGPUVertexFormat_Float32x3;
	vertAttrs1.offset = 0;
	vertAttrs1.shaderLocation = 0;

	WGPUVertexAttribute vertAttrs2 = {};
	vertAttrs2.format = WGPUVertexFormat_Float32x4;
	vertAttrs2.offset = 0;
	vertAttrs2.shaderLocation = 1;

	WGPUVertexBufferLayout vertexBufferLayouts[2] = {};
	vertexBufferLayouts[0].arrayStride = 3 * sizeof(float);
	vertexBufferLayouts[0].attributeCount = 1;
	vertexBufferLayouts[0].attributes = &vertAttrs1;

	vertexBufferLayouts[1].arrayStride = 4 * sizeof(float);
	vertexBufferLayouts[1].attributeCount = 1;
	vertexBufferLayouts[1].attributes = &vertAttrs2;

	// Fragment state
	WGPUBlendState blend = {};
	blend.color.operation = WGPUBlendOperation_Add;
	blend.color.srcFactor = WGPUBlendFactor_One;
	blend.color.dstFactor = WGPUBlendFactor_Zero;
	blend.alpha.operation = WGPUBlendOperation_Add;
	blend.alpha.srcFactor = WGPUBlendFactor_One;
	blend.alpha.dstFactor = WGPUBlendFactor_Zero;
	WGPUColorTargetState colorTarget = {};
	colorTarget.format = webgpu::getSurfaceFormat();
	colorTarget.blend = &blend;
	colorTarget.writeMask = WGPUColorWriteMask_All;

	WGPUFragmentState fragment = {};
	fragment.module = fragMod;
	fragment.entryPoint = { "main", WGPU_STRLEN };
	fragment.targetCount = 1;
	fragment.targets = &colorTarget;

	WGPURenderPipelineDescriptor desc = {};
	desc.fragment = &fragment;

	// Other state
	desc.layout = pipelineLayout;
	desc.depthStencil = nullptr;

	desc.vertex.module = vertMod;
	desc.vertex.entryPoint = { "main", WGPU_STRLEN };
	desc.vertex.bufferCount = 2;
	desc.vertex.buffers = vertexBufferLayouts;

	desc.multisample.count = 1;
	desc.multisample.mask = 0xFFFFFFFF;
	desc.multisample.alphaToCoverageEnabled = false;

	desc.primitive.frontFace = WGPUFrontFace_CCW;
	desc.primitive.cullMode = WGPUCullMode_None;
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleStrip;
	desc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;

	pipeline = wgpuDeviceCreateRenderPipeline(device, &desc);

	wgpuPipelineLayoutRelease(pipelineLayout);

	wgpuShaderModuleRelease(fragMod);
	wgpuShaderModuleRelease(vertMod);

	float const positions[] = {
		-0.5f, 0.5f, 0.0f,
		 0.5f, 0.5f, 0.0f,
		-0.5f,-0.5f, 0.0f,
		 0.5f,-0.5f, 0.0f
	};

	float const colors[] = {
		1.0f, 0.0f, 0.0f, 1.0f,
		0.0f, 1.0f, 0.0f, 1.0f,
		0.0f, 0.0f, 1.0f, 1.0f,
		1.0f, 1.0f, 0.0f, 1.0f
	};

	vertexBuffer  = createBuffer(positions, sizeof(positions), WGPUBufferUsage_Vertex);
	colorBuffer   = createBuffer(colors,    sizeof(colors),    WGPUBufferUsage_Vertex);

}

bool redraw() {
	// Follow the browser window size (reconfigure the surface on resize).
	uint32_t w = (uint32_t)canvas_get_width();
	uint32_t h = (uint32_t)canvas_get_height();
	if (w != curW || h != curH) {
		configureSurface(w, h);
	}

	WGPUSurfaceTexture surfaceTexture;
	wgpuSurfaceGetCurrentTexture(surface, &surfaceTexture);								// acquire the current texture
	WGPUTextureView backBufView = wgpuTextureCreateView(surfaceTexture.texture, nullptr);	// create textureView

	WGPURenderPassColorAttachment colorDesc = {};
	colorDesc.view    = backBufView;
	colorDesc.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
	colorDesc.loadOp  = WGPULoadOp_Clear;
	colorDesc.storeOp = WGPUStoreOp_Store;
	colorDesc.clearValue.r = 1.0f;
	colorDesc.clearValue.g = 1.0f;
	colorDesc.clearValue.b = 1.0f;
	colorDesc.clearValue.a = 1.0f;

	WGPURenderPassDescriptor renderPass = {};
	renderPass.colorAttachmentCount = 1;
	renderPass.colorAttachments = &colorDesc;

	WGPUCommandEncoder encoder = wgpuDeviceCreateCommandEncoder(device, nullptr);			// create encoder
	WGPURenderPassEncoder pass = wgpuCommandEncoderBeginRenderPass(encoder, &renderPass);	// create pass

	// draw the triangle
	wgpuRenderPassEncoderSetPipeline(pass, pipeline);
	wgpuRenderPassEncoderSetVertexBuffer(pass, 0, vertexBuffer, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderSetVertexBuffer(pass, 1, colorBuffer,  0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderDraw(pass, 4, 1, 0, 0);

	wgpuRenderPassEncoderEnd(pass);
	wgpuRenderPassEncoderRelease(pass);														// release pass
	WGPUCommandBuffer commands = wgpuCommandEncoderFinish(encoder, nullptr);				// create commands
	wgpuCommandEncoderRelease(encoder);														// release encoder

	wgpuQueueSubmit(queue, 1, &commands);
	wgpuCommandBufferRelease(commands);														// release commands

	wgpuTextureViewRelease(backBufView);													// release textureView
	wgpuTextureRelease(surfaceTexture.texture);												// release surface texture

	return true;
}

// Called once the device has been obtained: set up the surface, pipeline and
// start the render loop.
void start() {
	queue = wgpuDeviceGetQueue(device);
	webgpu::createSurface(device);
	createPipelineAndBuffers();

	if (window::Handle wHnd = window::create()) {
		window::show(wHnd);
		window::loop(wHnd, redraw);
	}
}

void onDeviceRequestEnded(WGPURequestDeviceStatus status, WGPUDevice dev, WGPUStringView message, void* /*userdata1*/, void* /*userdata2*/) {
	if (status != WGPURequestDeviceStatus_Success) {
		printf("Failed to get a WebGPU device: %.*s\n", (int)message.length, message.data);
		return;
	}
	device = dev;
	start();
}

void onAdapterRequestEnded(WGPURequestAdapterStatus status, WGPUAdapter adapter, WGPUStringView message, void* /*userdata1*/, void* /*userdata2*/) {
	if (status != WGPURequestAdapterStatus_Success) {
		printf("Failed to get a WebGPU adapter: %.*s\n", (int)message.length, message.data);
		return;
	}
	WGPUDeviceDescriptor deviceDesc = {};
	WGPURequestDeviceCallbackInfo callbackInfo = {};
	callbackInfo.mode = WGPUCallbackMode_AllowSpontaneous;
	callbackInfo.callback = onDeviceRequestEnded;
	wgpuAdapterRequestDevice(adapter, &deviceDesc, callbackInfo);
}

extern "C" int __main__(int /*argc*/, char* /*argv*/[]) {
	instance = wgpuCreateInstance(nullptr);

	WGPURequestAdapterCallbackInfo callbackInfo = {};
	callbackInfo.mode = WGPUCallbackMode_AllowSpontaneous;
	callbackInfo.callback = onAdapterRequestEnded;
	wgpuInstanceRequestAdapter(instance, nullptr, callbackInfo);

	return 0;
}
