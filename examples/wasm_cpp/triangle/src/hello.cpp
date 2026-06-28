// forked from https://github.com/cwoffenden/hello-webgpu

#include <stdio.h>
#include <string.h>
#include <webgpu/webgpu.h>
#include <emscripten/html5.h>

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
WGPUBuffer vertBuf; // vertex buffer with triangle position and colours
WGPUBuffer indxBuf; // index buffer

void webgpu::createSurface(WGPUDevice device) {
	WGPUEmscriptenSurfaceSourceCanvasHTMLSelector canvasDesc = {};
	canvasDesc.chain.sType = WGPUSType_EmscriptenSurfaceSourceCanvasHTMLSelector;
	canvasDesc.selector = { "canvas", WGPU_STRLEN };

	WGPUSurfaceDescriptor surfDesc = {};
	surfDesc.nextInChain = &canvasDesc.chain;

	surface = wgpuInstanceCreateSurface(instance, &surfDesc);

	WGPUSurfaceConfiguration config = {};
	config.device      = device;
	config.format      = surfaceFormat;
	config.usage       = WGPUTextureUsage_RenderAttachment;
	config.width       = 640;
	config.height      = 480;
	config.alphaMode   = WGPUCompositeAlphaMode_Auto;
	config.presentMode = WGPUPresentMode_Fifo;

	wgpuSurfaceConfigure(surface, &config);
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
	struct VertexOut {
		@location(0) vCol : vec3<f32>,
		@builtin(position) Position : vec4<f32>
	}
	@vertex
	fn main(
		@location(0) aPos : vec3<f32>,
		@location(1) aCol : vec3<f32>
	) -> VertexOut {
		var output : VertexOut;
		output.Position = vec4<f32>(aPos, 1.0);
		output.vCol = aCol;
		return output;
	}
)";

char const triangle_frag_wgsl[] = R"(
	@fragment
	fn main(@location(0) vCol : vec3<f32>) -> @location(0) vec4<f32> {
		return vec4<f32>(vCol, 1.0);
	}
)";

void createPipelineAndBuffers() {
	WGPUShaderModule vertMod = createShader(triangle_vert_wgsl);
	WGPUShaderModule fragMod = createShader(triangle_frag_wgsl);

	// Simple pipeline layout without bind group layouts
	WGPUPipelineLayoutDescriptor layoutDesc = {};
	WGPUPipelineLayout pipelineLayout = wgpuDeviceCreatePipelineLayout(device, &layoutDesc);

	// describe buffer layouts
	WGPUVertexAttribute vertAttrs[2] = {};
	vertAttrs[0].format = WGPUVertexFormat_Float32x3;
	vertAttrs[0].offset = 0;
	vertAttrs[0].shaderLocation = 0;
	vertAttrs[1].format = WGPUVertexFormat_Float32x3;
	vertAttrs[1].offset = 3 * sizeof(float);
	vertAttrs[1].shaderLocation = 1;
	WGPUVertexBufferLayout vertexBufferLayout = {};
	vertexBufferLayout.arrayStride = 6 * sizeof(float);
	vertexBufferLayout.attributeCount = 2;
	vertexBufferLayout.attributes = vertAttrs;

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
	desc.vertex.bufferCount = 1;
	desc.vertex.buffers = &vertexBufferLayout;

	desc.multisample.count = 1;
	desc.multisample.mask = 0xFFFFFFFF;
	desc.multisample.alphaToCoverageEnabled = false;

	desc.primitive.frontFace = WGPUFrontFace_CCW;
	desc.primitive.cullMode = WGPUCullMode_None;
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
	desc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;

	pipeline = wgpuDeviceCreateRenderPipeline(device, &desc);

	wgpuPipelineLayoutRelease(pipelineLayout);
	wgpuShaderModuleRelease(fragMod);
	wgpuShaderModuleRelease(vertMod);

	// create the buffers (x, y, z, r, g, b)
	float const vertData[] = {
		-0.5f, -0.5f, 0.0f, 0.0f, 0.0f, 1.0f, // v0
		 0.5f, -0.5f, 0.0f, 0.0f, 1.0f, 0.0f, // v1
		-0.0f,  0.5f, 0.0f, 1.0f, 0.0f, 0.0f, // v2
	};
	uint16_t const indxData[] = {
		0, 1, 2,
		0 // padding (better way of doing this?)
	};
	vertBuf = createBuffer(vertData, sizeof(vertData), WGPUBufferUsage_Vertex);
	indxBuf = createBuffer(indxData, sizeof(indxData), WGPUBufferUsage_Index);
}

bool redraw() {
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

	// draw the triangle (comment these five lines to simply clear the screen)
	wgpuRenderPassEncoderSetPipeline(pass, pipeline);
	wgpuRenderPassEncoderSetVertexBuffer(pass, 0, vertBuf, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderSetIndexBuffer(pass, indxBuf, WGPUIndexFormat_Uint16, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderDrawIndexed(pass, 3, 1, 0, 0, 0);

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
