// forked from https://github.com/cwoffenden/hello-webgpu

#include <stdio.h>
#include <string.h>
#include <math.h>
#include <webgpu/webgpu.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/em_js.h>

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#include "frog_jpg.h"

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

//****************************************************************************/
// Minimal column-major 4x4 matrix helpers (gl-matrix compatible)

static void mat4_identity(float* m) {
	for (int i = 0; i < 16; i++) m[i] = 0.0f;
	m[0] = m[5] = m[10] = m[15] = 1.0f;
}

static void mat4_perspective(float* m, float fovy, float aspect, float near_, float far_) {
	float f = 1.0f / tanf(fovy / 2.0f);
	for (int i = 0; i < 16; i++) m[i] = 0.0f;
	m[0]  = f / aspect;
	m[5]  = f;
	m[11] = -1.0f;
	float nf = 1.0f / (near_ - far_);
	m[10] = (far_ + near_) * nf;
	m[14] = 2.0f * far_ * near_ * nf;
}

static void mat4_translate(float* m, float x, float y, float z) {
	m[12] = m[0] * x + m[4] * y + m[8]  * z + m[12];
	m[13] = m[1] * x + m[5] * y + m[9]  * z + m[13];
	m[14] = m[2] * x + m[6] * y + m[10] * z + m[14];
	m[15] = m[3] * x + m[7] * y + m[11] * z + m[15];
}

static void mat4_rotate(float* m, float rad, float x, float y, float z) {
	float len = sqrtf(x * x + y * y + z * z);
	if (len < 1e-6f) return;
	x /= len; y /= len; z /= len;
	float s = sinf(rad), c = cosf(rad), t = 1.0f - c;
	float a00 = m[0], a01 = m[1], a02 = m[2],  a03 = m[3];
	float a10 = m[4], a11 = m[5], a12 = m[6],  a13 = m[7];
	float a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
	float b00 = x * x * t + c,     b01 = y * x * t + z * s, b02 = z * x * t - y * s;
	float b10 = x * y * t - z * s, b11 = y * y * t + c,     b12 = z * y * t + x * s;
	float b20 = x * z * t + y * s, b21 = y * z * t - x * s, b22 = z * z * t + c;
	m[0]  = a00 * b00 + a10 * b01 + a20 * b02;
	m[1]  = a01 * b00 + a11 * b01 + a21 * b02;
	m[2]  = a02 * b00 + a12 * b01 + a22 * b02;
	m[3]  = a03 * b00 + a13 * b01 + a23 * b02;
	m[4]  = a00 * b10 + a10 * b11 + a20 * b12;
	m[5]  = a01 * b10 + a11 * b11 + a21 * b12;
	m[6]  = a02 * b10 + a12 * b11 + a22 * b12;
	m[7]  = a03 * b10 + a13 * b11 + a23 * b12;
	m[8]  = a00 * b20 + a10 * b21 + a20 * b22;
	m[9]  = a01 * b20 + a11 * b21 + a21 * b22;
	m[10] = a02 * b20 + a12 * b21 + a22 * b22;
	m[11] = a03 * b20 + a13 * b21 + a23 * b22;
}

static void mat4_multiply(float* out, const float* a, const float* b) {
	for (int i = 0; i < 4; i++) {
		float b0 = b[i * 4 + 0], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
		out[i * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
		out[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
		out[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
		out[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
	}
}

//****************************************************************************/

WGPUInstance instance;
WGPUDevice device;
WGPUQueue queue;
WGPUSurface surface;

WGPUTextureFormat surfaceFormat = WGPUTextureFormat_BGRA8Unorm;
WGPUTextureFormat depthFormat   = WGPUTextureFormat_Depth24Plus;

WGPURenderPipeline pipeline;
WGPUBuffer vertBuf;   // position buffer
WGPUBuffer coordBuf;  // texture coordinate buffer
WGPUBuffer indxBuf;   // index buffer
WGPUBuffer uniformBuf;
WGPUBindGroup bindGroup;
WGPUTexture depthTexture = nullptr;
WGPUTextureView depthView = nullptr;
uint32_t depthW = 0, depthH = 0;

float projection[16];

// (Re)create the depth texture so it always matches the surface texture size.
void ensureDepth(uint32_t w, uint32_t h) {
	if (depthTexture && depthW == w && depthH == h) return;
	if (depthTexture) {
		wgpuTextureViewRelease(depthView);
		wgpuTextureDestroy(depthTexture);
		wgpuTextureRelease(depthTexture);
	}
	WGPUTextureDescriptor depthDesc = {};
	depthDesc.usage = WGPUTextureUsage_RenderAttachment;
	depthDesc.dimension = WGPUTextureDimension_2D;
	depthDesc.size = { w, h, 1 };
	depthDesc.format = depthFormat;
	depthDesc.mipLevelCount = 1;
	depthDesc.sampleCount = 1;
	depthTexture = wgpuDeviceCreateTexture(device, &depthDesc);
	depthView = wgpuTextureCreateView(depthTexture, nullptr);
	depthW = w;
	depthH = h;
}

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

// Decode an in-memory image and upload it to a new RGBA8 texture.
WGPUTexture createTextureFromMemory(const unsigned char* data, unsigned int len) {
	int w = 0, h = 0, comp = 0;
	unsigned char* pixels = stbi_load_from_memory(data, (int)len, &w, &h, &comp, 4);
	if (!pixels) {
		printf("Failed to decode embedded image\n");
		return nullptr;
	}

	WGPUTextureDescriptor texDesc = {};
	texDesc.usage = WGPUTextureUsage_TextureBinding | WGPUTextureUsage_CopyDst;
	texDesc.dimension = WGPUTextureDimension_2D;
	texDesc.size = { (uint32_t)w, (uint32_t)h, 1 };
	texDesc.format = WGPUTextureFormat_RGBA8Unorm;
	texDesc.mipLevelCount = 1;
	texDesc.sampleCount = 1;
	WGPUTexture texture = wgpuDeviceCreateTexture(device, &texDesc);

	WGPUTexelCopyTextureInfo destination = {};
	destination.texture = texture;
	destination.mipLevel = 0;
	destination.origin = { 0, 0, 0 };
	destination.aspect = WGPUTextureAspect_All;

	WGPUTexelCopyBufferLayout dataLayout = {};
	dataLayout.offset = 0;
	dataLayout.bytesPerRow = (uint32_t)(w * 4);
	dataLayout.rowsPerImage = (uint32_t)h;

	WGPUExtent3D writeSize = { (uint32_t)w, (uint32_t)h, 1 };
	wgpuQueueWriteTexture(queue, &destination, pixels, (size_t)(w * h * 4), &dataLayout, &writeSize);

	stbi_image_free(pixels);
	return texture;
}

char const texture_vert_wgsl[] = R"(
	struct Uniforms {
		modelViewProjectionMatrix : mat4x4<f32>
	};
	@binding(0) @group(0) var<uniform> uniforms : Uniforms;

	struct VertexOutput {
		@builtin(position) Position : vec4<f32>,
		@location(0) vTextureCoord : vec2<f32>
	}

	@vertex
	fn main(
		@location(0) position : vec3<f32>,
		@location(1) textureCoord : vec2<f32>
	) -> VertexOutput {
		var output : VertexOutput;
		output.vTextureCoord = textureCoord;
		output.Position = uniforms.modelViewProjectionMatrix * vec4<f32>(position, 1.0);
		return output;
	}
)";

char const texture_frag_wgsl[] = R"(
	@binding(1) @group(0) var mySampler : sampler;
	@binding(2) @group(0) var myTexture : texture_2d<f32>;

	@fragment
	fn main(
		@location(0) vTextureCoord : vec2<f32>
	) -> @location(0) vec4<f32> {
		return textureSample(myTexture, mySampler, vTextureCoord);
	}
)";

void createPipelineAndBuffers() {
	WGPUShaderModule vertMod = createShader(texture_vert_wgsl);
	WGPUShaderModule fragMod = createShader(texture_frag_wgsl);

	// describe buffer layouts
	WGPUVertexAttribute posAttr = {};
	posAttr.format = WGPUVertexFormat_Float32x3;
	posAttr.offset = 0;
	posAttr.shaderLocation = 0;

	WGPUVertexAttribute coordAttr = {};
	coordAttr.format = WGPUVertexFormat_Float32x2;
	coordAttr.offset = 0;
	coordAttr.shaderLocation = 1;

	WGPUVertexBufferLayout vertexBufferLayouts[2] = {};
	vertexBufferLayouts[0].arrayStride = 3 * sizeof(float);
	vertexBufferLayouts[0].attributeCount = 1;
	vertexBufferLayouts[0].attributes = &posAttr;
	vertexBufferLayouts[1].arrayStride = 2 * sizeof(float);
	vertexBufferLayouts[1].attributeCount = 1;
	vertexBufferLayouts[1].attributes = &coordAttr;

	// Fragment state
	WGPUColorTargetState colorTarget = {};
	colorTarget.format = webgpu::getSurfaceFormat();
	colorTarget.writeMask = WGPUColorWriteMask_All;

	WGPUFragmentState fragment = {};
	fragment.module = fragMod;
	fragment.entryPoint = { "main", WGPU_STRLEN };
	fragment.targetCount = 1;
	fragment.targets = &colorTarget;

	// Depth state
	WGPUDepthStencilState depthStencil = {};
	depthStencil.format = depthFormat;
	depthStencil.depthWriteEnabled = WGPUOptionalBool_True;
	depthStencil.depthCompare = WGPUCompareFunction_Less;

	WGPURenderPipelineDescriptor desc = {};
	desc.layout = nullptr; // auto layout
	desc.fragment = &fragment;
	desc.depthStencil = &depthStencil;

	desc.vertex.module = vertMod;
	desc.vertex.entryPoint = { "main", WGPU_STRLEN };
	desc.vertex.bufferCount = 2;
	desc.vertex.buffers = vertexBufferLayouts;

	desc.multisample.count = 1;
	desc.multisample.mask = 0xFFFFFFFF;
	desc.multisample.alphaToCoverageEnabled = false;

	desc.primitive.frontFace = WGPUFrontFace_CCW;
	desc.primitive.cullMode = WGPUCullMode_None;
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
	desc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;

	pipeline = wgpuDeviceCreateRenderPipeline(device, &desc);

	wgpuShaderModuleRelease(fragMod);
	wgpuShaderModuleRelease(vertMod);

	// Cube data (24 vertices, 6 faces)
	float const positions[] = {
		// Front face
		-0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f,
		// Back face
		-0.5f, -0.5f, -0.5f,  0.5f, -0.5f, -0.5f,  0.5f,  0.5f, -0.5f, -0.5f,  0.5f, -0.5f,
		// Top face
		 0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f,
		// Bottom face
		-0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f, -0.5f, -0.5f, -0.5f, -0.5f,
		// Right face
		 0.5f, -0.5f,  0.5f,  0.5f,  0.5f,  0.5f,  0.5f,  0.5f, -0.5f,  0.5f, -0.5f, -0.5f,
		// Left face
		-0.5f, -0.5f,  0.5f, -0.5f,  0.5f,  0.5f, -0.5f,  0.5f, -0.5f, -0.5f, -0.5f, -0.5f
	};
	float const textureCoords[] = {
		// Front face
		0.0f, 0.0f,  1.0f, 0.0f,  1.0f, 1.0f,  0.0f, 1.0f,
		// Back face
		1.0f, 0.0f,  1.0f, 1.0f,  0.0f, 1.0f,  0.0f, 0.0f,
		// Top face
		0.0f, 1.0f,  0.0f, 0.0f,  1.0f, 0.0f,  1.0f, 1.0f,
		// Bottom face
		1.0f, 1.0f,  0.0f, 1.0f,  0.0f, 0.0f,  1.0f, 0.0f,
		// Right face
		1.0f, 0.0f,  1.0f, 1.0f,  0.0f, 1.0f,  0.0f, 0.0f,
		// Left face
		0.0f, 0.0f,  1.0f, 0.0f,  1.0f, 1.0f,  0.0f, 1.0f
	};
	uint32_t const indices[] = {
		 0,  1,  2,    0,  2,  3,  // Front face
		 4,  5,  6,    4,  6,  7,  // Back face
		 8,  9, 10,    8, 10, 11,  // Top face
		12, 13, 14,   12, 14, 15,  // Bottom face
		16, 17, 18,   16, 18, 19,  // Right face
		20, 21, 22,   20, 22, 23   // Left face
	};

	vertBuf  = createBuffer(positions,     sizeof(positions),     WGPUBufferUsage_Vertex);
	coordBuf = createBuffer(textureCoords, sizeof(textureCoords), WGPUBufferUsage_Vertex);
	indxBuf  = createBuffer(indices,       sizeof(indices),       WGPUBufferUsage_Index);

	// Uniform buffer (4x4 matrix)
	WGPUBufferDescriptor uboDesc = {};
	uboDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
	uboDesc.size  = 16 * sizeof(float);
	uniformBuf = wgpuDeviceCreateBuffer(device, &uboDesc);

	// Texture and sampler
	WGPUTexture texture = createTextureFromMemory(frog_jpg, frog_jpg_len);
	WGPUTextureView texView = wgpuTextureCreateView(texture, nullptr);

	WGPUSamplerDescriptor samplerDesc = {};
	samplerDesc.addressModeU = WGPUAddressMode_ClampToEdge;
	samplerDesc.addressModeV = WGPUAddressMode_ClampToEdge;
	samplerDesc.addressModeW = WGPUAddressMode_ClampToEdge;
	samplerDesc.magFilter = WGPUFilterMode_Linear;
	samplerDesc.minFilter = WGPUFilterMode_Linear;
	samplerDesc.mipmapFilter = WGPUMipmapFilterMode_Nearest;
	samplerDesc.lodMinClamp = 0.0f;
	samplerDesc.lodMaxClamp = 32.0f;
	samplerDesc.maxAnisotropy = 1;
	WGPUSampler sampler = wgpuDeviceCreateSampler(device, &samplerDesc);

	WGPUBindGroupEntry entries[3] = {};
	entries[0].binding = 0;
	entries[0].buffer  = uniformBuf;
	entries[0].offset  = 0;
	entries[0].size    = 16 * sizeof(float);
	entries[1].binding = 1;
	entries[1].sampler = sampler;
	entries[2].binding = 2;
	entries[2].textureView = texView;

	WGPUBindGroupDescriptor bgDesc = {};
	bgDesc.layout = wgpuRenderPipelineGetBindGroupLayout(pipeline, 0);
	bgDesc.entryCount = 3;
	bgDesc.entries = entries;
	bindGroup = wgpuDeviceCreateBindGroup(device, &bgDesc);

	// Projection matrix (uses the current surface aspect ratio)
	mat4_perspective(projection, 45.0f, (float)curW / (float)curH, 0.1f, 100.0f);
}

bool redraw() {
	// Update the model-view-projection matrix
	float view[16];
	mat4_identity(view);
	mat4_translate(view, 0.0f, 0.0f, -3.0f);
	float rad = (float)(emscripten_get_now() / 1000.0);
	mat4_rotate(view, rad, 1.0f, 1.0f, 1.0f);
	// Follow the browser window size (reconfigure the surface + projection on resize).
	uint32_t winW = (uint32_t)canvas_get_width();
	uint32_t winH = (uint32_t)canvas_get_height();
	if (winW != curW || winH != curH) {
		configureSurface(winW, winH);
		mat4_perspective(projection, 45.0f, (float)curW / (float)curH, 0.1f, 100.0f);
	}

	float mvp[16];
	mat4_multiply(mvp, projection, view);
	wgpuQueueWriteBuffer(queue, uniformBuf, 0, mvp, sizeof(mvp));

	WGPUSurfaceTexture surfaceTexture;
	wgpuSurfaceGetCurrentTexture(surface, &surfaceTexture);
	WGPUTextureView backBufView = wgpuTextureCreateView(surfaceTexture.texture, nullptr);

	ensureDepth(wgpuTextureGetWidth(surfaceTexture.texture), wgpuTextureGetHeight(surfaceTexture.texture));

	WGPURenderPassColorAttachment colorDesc = {};
	colorDesc.view       = backBufView;
	colorDesc.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
	colorDesc.loadOp     = WGPULoadOp_Clear;
	colorDesc.storeOp    = WGPUStoreOp_Store;
	colorDesc.clearValue = { 1.0f, 1.0f, 1.0f, 1.0f };

	WGPURenderPassDepthStencilAttachment depthAttach = {};
	depthAttach.view            = depthView;
	depthAttach.depthLoadOp     = WGPULoadOp_Clear;
	depthAttach.depthStoreOp    = WGPUStoreOp_Store;
	depthAttach.depthClearValue = 1.0f;

	WGPURenderPassDescriptor renderPass = {};
	renderPass.colorAttachmentCount = 1;
	renderPass.colorAttachments = &colorDesc;
	renderPass.depthStencilAttachment = &depthAttach;

	WGPUCommandEncoder encoder = wgpuDeviceCreateCommandEncoder(device, nullptr);
	WGPURenderPassEncoder pass = wgpuCommandEncoderBeginRenderPass(encoder, &renderPass);

	wgpuRenderPassEncoderSetPipeline(pass, pipeline);
	wgpuRenderPassEncoderSetBindGroup(pass, 0, bindGroup, 0, nullptr);
	wgpuRenderPassEncoderSetVertexBuffer(pass, 0, vertBuf, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderSetVertexBuffer(pass, 1, coordBuf, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderSetIndexBuffer(pass, indxBuf, WGPUIndexFormat_Uint32, 0, WGPU_WHOLE_SIZE);
	wgpuRenderPassEncoderDrawIndexed(pass, 36, 1, 0, 0, 0);

	wgpuRenderPassEncoderEnd(pass);
	wgpuRenderPassEncoderRelease(pass);
	WGPUCommandBuffer commands = wgpuCommandEncoderFinish(encoder, nullptr);
	wgpuCommandEncoderRelease(encoder);

	wgpuQueueSubmit(queue, 1, &commands);
	wgpuCommandBufferRelease(commands);
	wgpuTextureViewRelease(backBufView);
	wgpuTextureRelease(surfaceTexture.texture);

	return true;
}

//****************************************************************************/

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
