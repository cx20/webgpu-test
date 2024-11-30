// forked from https://github.com/cwoffenden/hello-webgpu

#include <string.h>
#include <webgpu/webgpu.h>
#include <emscripten/html5.h>
#include <emscripten/html5_webgpu.h>

namespace window {
	typedef struct HandleImpl* Handle;
	typedef bool (*Redraw) ();
	Handle _Nullable create(unsigned winW = 0, unsigned winH = 0, const char* _Nullable name = nullptr);
	void destroy(Handle _Nonnull wHnd);
	void show(Handle _Nonnull wHnd, bool show = true);
	void loop(Handle _Nonnull wHnd, Redraw _Nullable func = nullptr);
}

namespace webgpu {
	WGPUDevice create(window::Handle window, WGPUBackendType type = WGPUBackendType_Force32);
	WGPUSwapChain createSwapChain(WGPUDevice device);
	WGPUTextureFormat getSwapChainFormat(WGPUDevice device);
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

WGPUDevice webgpu::create(window::Handle /*window*/, WGPUBackendType /*type*/) {
	return emscripten_webgpu_get_device();
}

WGPUSwapChain webgpu::createSwapChain(WGPUDevice device) {
	WGPUSurfaceDescriptorFromCanvasHTMLSelector canvDesc = {};
	canvDesc.chain.sType = WGPUSType_SurfaceDescriptorFromCanvasHTMLSelector;
	canvDesc.selector = "canvas";
	
	WGPUSurfaceDescriptor surfDesc = {};
	surfDesc.nextInChain = reinterpret_cast<WGPUChainedStruct*>(&canvDesc);
	
	WGPUSurface surface = wgpuInstanceCreateSurface(nullptr, &surfDesc);
	
	WGPUSwapChainDescriptor swapDesc = {};
	swapDesc.usage  = WGPUTextureUsage_RenderAttachment;
	swapDesc.format = WGPUTextureFormat_BGRA8Unorm;
	swapDesc.width  = 640;
	swapDesc.height = 480;
	swapDesc.presentMode = WGPUPresentMode_Fifo;
	
	WGPUSwapChain swapchain = wgpuDeviceCreateSwapChain(device, surface, &swapDesc);
	
	return swapchain;
}

WGPUTextureFormat webgpu::getSwapChainFormat(WGPUDevice /*device*/) {
	return WGPUTextureFormat_BGRA8Unorm;
}

WGPUDevice device;
WGPUQueue queue;
WGPUSwapChain swapchain;

WGPURenderPipeline pipeline;
WGPUBuffer vertexBuffer; // vertex buffer with position
WGPUBuffer colorBuffer;  // vertex buffer with colours

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

WGPUShaderModule createShader(const uint32_t* code, uint32_t size, const char* label = nullptr) {
	WGPUShaderModuleSPIRVDescriptor spirv = {};
	spirv.chain.sType = WGPUSType_ShaderModuleSPIRVDescriptor;
	spirv.codeSize = size / sizeof(uint32_t);
	spirv.code = code;
	WGPUShaderModuleDescriptor desc = {};
	desc.nextInChain = reinterpret_cast<WGPUChainedStruct*>(&spirv);
	desc.label = label;
	return wgpuDeviceCreateShaderModule(device, &desc);
}

WGPUShaderModule createShader(const char* const code, const char* label = nullptr) {
	WGPUShaderModuleWGSLDescriptor wgsl = {};
	wgsl.chain.sType = WGPUSType_ShaderModuleWGSLDescriptor;
	wgsl.code = code;
	WGPUShaderModuleDescriptor desc = {};
	desc.nextInChain = reinterpret_cast<WGPUChainedStruct*>(&wgsl);
	desc.label = label;
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

	WGPUVertexBufferLayout vertexBufferLayouts[2];
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
	colorTarget.format = webgpu::getSwapChainFormat(device);
	colorTarget.blend = &blend;
	colorTarget.writeMask = WGPUColorWriteMask_All;

	WGPUFragmentState fragment = {};
	fragment.module = fragMod;
	fragment.entryPoint = "main";
	fragment.targetCount = 1;
	fragment.targets = &colorTarget;

	WGPURenderPipelineDescriptor desc = {};
	desc.fragment = &fragment;

	// Other state
	desc.layout = pipelineLayout;
	desc.depthStencil = nullptr;

	desc.vertex.module = vertMod;
	desc.vertex.entryPoint = "main";
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
	WGPUTextureView backBufView = wgpuSwapChainGetCurrentTextureView(swapchain);			// create textureView

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

	return true;
}

extern "C" int __main__(int /*argc*/, char* /*argv*/[]) {
	if (window::Handle wHnd = window::create()) {
		if ((device = webgpu::create(wHnd))) {
			queue = wgpuDeviceGetQueue(device);
			swapchain = webgpu::createSwapChain(device);
			createPipelineAndBuffers();

			window::show(wHnd);
			window::loop(wHnd, redraw);
		}
	}
	return 0;
}
