// forked from https://github.com/cwoffenden/hello-webgpu
//
// "complex" sample: glTF models + cubemap skybox, with assets loaded at
// runtime over the network (no embedded assets).
//
// Milestone 1: cubemap skybox + CesiumMilkTruck (node animation).

#include <stdio.h>
#include <string.h>
#include <math.h>
#include <vector>
#include <webgpu/webgpu.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/em_js.h>

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

#define CGLTF_IMPLEMENTATION
#include "cgltf.h"

static const float PI = 3.14159265358979323846f;

//****************************************************************************/
// Column-major 4x4 matrix helpers (gl-matrix compatible)

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

static void mat4_lookat(float* m, const float* eye, const float* center, const float* up) {
	float z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
	float zl = sqrtf(z0 * z0 + z1 * z1 + z2 * z2);
	if (zl == 0.0f) { mat4_identity(m); return; }
	z0 /= zl; z1 /= zl; z2 /= zl;
	float x0 = up[1] * z2 - up[2] * z1;
	float x1 = up[2] * z0 - up[0] * z2;
	float x2 = up[0] * z1 - up[1] * z0;
	float xl = sqrtf(x0 * x0 + x1 * x1 + x2 * x2);
	if (xl == 0.0f) { x0 = x1 = x2 = 0.0f; } else { x0 /= xl; x1 /= xl; x2 /= xl; }
	float y0 = z1 * x2 - z2 * x1;
	float y1 = z2 * x0 - z0 * x2;
	float y2 = z0 * x1 - z1 * x0;
	m[0] = x0; m[1] = y0; m[2] = z0; m[3] = 0.0f;
	m[4] = x1; m[5] = y1; m[6] = z1; m[7] = 0.0f;
	m[8] = x2; m[9] = y2; m[10] = z2; m[11] = 0.0f;
	m[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
	m[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
	m[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
	m[15] = 1.0f;
}

static void mat4_multiply(float* out, const float* a, const float* b) {
	float r[16];
	for (int i = 0; i < 4; i++) {
		float b0 = b[i * 4 + 0], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
		r[i * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
		r[i * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
		r[i * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
		r[i * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
	}
	for (int i = 0; i < 16; i++) out[i] = r[i];
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
	m[0]  = a00 * b00 + a10 * b01 + a20 * b02;  m[1]  = a01 * b00 + a11 * b01 + a21 * b02;
	m[2]  = a02 * b00 + a12 * b01 + a22 * b02;  m[3]  = a03 * b00 + a13 * b01 + a23 * b02;
	m[4]  = a00 * b10 + a10 * b11 + a20 * b12;  m[5]  = a01 * b10 + a11 * b11 + a21 * b12;
	m[6]  = a02 * b10 + a12 * b11 + a22 * b12;  m[7]  = a03 * b10 + a13 * b11 + a23 * b12;
	m[8]  = a00 * b20 + a10 * b21 + a20 * b22;  m[9]  = a01 * b20 + a11 * b21 + a21 * b22;
	m[10] = a02 * b20 + a12 * b21 + a22 * b22;  m[11] = a03 * b20 + a13 * b21 + a23 * b22;
}

// out = T * R * S from translation, rotation quaternion (x,y,z,w) and scale
static void mat4_from_trs(float* out, const float* t, const float* q, const float* s) {
	float x = q[0], y = q[1], z = q[2], w = q[3];
	float x2 = x + x, y2 = y + y, z2 = z + z;
	float xx = x * x2, xy = x * y2, xz = x * z2;
	float yy = y * y2, yz = y * z2, zz = z * z2;
	float wx = w * x2, wy = w * y2, wz = w * z2;
	float sx = s[0], sy = s[1], sz = s[2];
	out[0] = (1 - (yy + zz)) * sx; out[1] = (xy + wz) * sx;       out[2] = (xz - wy) * sx;       out[3] = 0;
	out[4] = (xy - wz) * sy;       out[5] = (1 - (xx + zz)) * sy; out[6] = (yz + wx) * sy;       out[7] = 0;
	out[8] = (xz + wy) * sz;       out[9] = (yz - wx) * sz;       out[10] = (1 - (xx + yy)) * sz; out[11] = 0;
	out[12] = t[0]; out[13] = t[1]; out[14] = t[2]; out[15] = 1;
}

static void mat4_transpose(float* out, const float* m) {
	float r[16];
	for (int i = 0; i < 4; i++)
		for (int j = 0; j < 4; j++)
			r[i * 4 + j] = m[j * 4 + i];
	for (int i = 0; i < 16; i++) out[i] = r[i];
}

static bool mat4_invert(float* out, const float* m) {
	float inv[16];
	inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
	inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
	inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
	inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
	inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
	inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
	inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
	inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
	inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
	inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
	inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
	inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
	inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
	inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
	inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
	inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];
	float det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
	if (det == 0.0f) { mat4_identity(out); return false; }
	det = 1.0f / det;
	for (int i = 0; i < 16; i++) out[i] = inv[i] * det;
	return true;
}

static void quat_slerp(float* out, const float* a, const float* b, float t) {
	float ax = a[0], ay = a[1], az = a[2], aw = a[3];
	float bx = b[0], by = b[1], bz = b[2], bw = b[3];
	float cosom = ax * bx + ay * by + az * bz + aw * bw;
	if (cosom < 0.0f) { cosom = -cosom; bx = -bx; by = -by; bz = -bz; bw = -bw; }
	float scale0, scale1;
	if (1.0f - cosom > 1e-6f) {
		float omega = acosf(cosom);
		float sinom = sinf(omega);
		scale0 = sinf((1.0f - t) * omega) / sinom;
		scale1 = sinf(t * omega) / sinom;
	} else {
		scale0 = 1.0f - t;
		scale1 = t;
	}
	out[0] = scale0 * ax + scale1 * bx;
	out[1] = scale0 * ay + scale1 * by;
	out[2] = scale0 * az + scale1 * bz;
	out[3] = scale0 * aw + scale1 * bw;
}

//****************************************************************************/
// WebGPU globals

WGPUInstance instance;
WGPUDevice device;
WGPUQueue queue;
WGPUSurface surface;

WGPUTextureFormat surfaceFormat = WGPUTextureFormat_BGRA8Unorm;
WGPUTextureFormat depthFormat   = WGPUTextureFormat_Depth24Plus;

WGPUTexture depthTexture = nullptr;
WGPUTextureView depthView = nullptr;
uint32_t depthW = 0, depthH = 0;

uint32_t curW = 0, curH = 0;

EM_JS(int, canvas_get_width,  (), { return window.innerWidth;  });
EM_JS(int, canvas_get_height, (), { return window.innerHeight; });

// Skybox
WGPURenderPipeline skyboxPipeline = nullptr;
WGPUBuffer skyboxVertexBuf = nullptr;
WGPUBuffer skyboxUniformBuf = nullptr;
WGPUBindGroup skyboxBindGroup = nullptr;
bool skyboxReady = false;

// Pending skybox face pixel data (collected as the 6 images arrive)
struct FacePixels { unsigned char* pixels; int w; int h; };
FacePixels skyboxFaces[6];
int skyboxFacesLoaded = 0;

//****************************************************************************/

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

void createSurface() {
	WGPUEmscriptenSurfaceSourceCanvasHTMLSelector canvasDesc = {};
	canvasDesc.chain.sType = WGPUSType_EmscriptenSurfaceSourceCanvasHTMLSelector;
	canvasDesc.selector = { "canvas", WGPU_STRLEN };
	WGPUSurfaceDescriptor surfDesc = {};
	surfDesc.nextInChain = &canvasDesc.chain;
	surface = wgpuInstanceCreateSurface(instance, &surfDesc);
	configureSurface((uint32_t)canvas_get_width(), (uint32_t)canvas_get_height());
}

void ensureDepth(uint32_t w, uint32_t h) {
	if (depthTexture && depthW == w && depthH == h) return;
	if (depthTexture) {
		wgpuTextureViewRelease(depthView);
		wgpuTextureDestroy(depthTexture);
		wgpuTextureRelease(depthTexture);
	}
	WGPUTextureDescriptor d = {};
	d.usage = WGPUTextureUsage_RenderAttachment;
	d.dimension = WGPUTextureDimension_2D;
	d.size = { w, h, 1 };
	d.format = depthFormat;
	d.mipLevelCount = 1;
	d.sampleCount = 1;
	depthTexture = wgpuDeviceCreateTexture(device, &d);
	depthView = wgpuTextureCreateView(depthTexture, nullptr);
	depthW = w; depthH = h;
}

WGPUShaderModule createShader(const char* code) {
	WGPUShaderSourceWGSL wgsl = {};
	wgsl.chain.sType = WGPUSType_ShaderSourceWGSL;
	wgsl.code = { code, WGPU_STRLEN };
	WGPUShaderModuleDescriptor desc = {};
	desc.nextInChain = &wgsl.chain;
	return wgpuDeviceCreateShaderModule(device, &desc);
}

//****************************************************************************/
// Async URL fetch (downloads to memory; the runtime frees the buffer after
// the callback returns, so consumers must copy what they need).

typedef void (*FetchCb)(void* user, const unsigned char* data, int size);

struct FetchReq { char url[512]; FetchCb cb; void* user; int retries; };

static void fetch_onload(void* arg, void* buffer, int size) {
	FetchReq* req = (FetchReq*)arg;
	req->cb(req->user, (const unsigned char*)buffer, size);
	delete req;
}

static void fetch_onerror(void* arg) {
	FetchReq* req = (FetchReq*)arg;
	if (req->retries > 0) {
		// Retry: shared CDNs (e.g. raw.githubusercontent.com) sometimes throttle.
		req->retries--;
		emscripten_async_wget_data(req->url, req, fetch_onload, fetch_onerror);
		return;
	}
	printf("fetch failed: %s\n", req->url);
	req->cb(req->user, nullptr, 0);
	delete req;
}

void fetchURL(const char* url, FetchCb cb, void* user) {
	FetchReq* req = new FetchReq();
	snprintf(req->url, sizeof(req->url), "%s", url);
	req->cb = cb;
	req->user = user;
	req->retries = 2;
	emscripten_async_wget_data(req->url, req, fetch_onload, fetch_onerror);
}

//****************************************************************************/
// Skybox

const char* skyboxVertWGSL = R"(
	struct SkyboxUniforms {
		projectionMatrix: mat4x4<f32>,
		viewMatrix: mat4x4<f32>
	};
	@binding(0) @group(0) var<uniform> uniforms: SkyboxUniforms;

	struct VertexOutput {
		@builtin(position) position: vec4<f32>,
		@location(0) vTexCoord: vec3<f32>
	};

	@vertex
	fn main(@location(0) position: vec3<f32>) -> VertexOutput {
		var output: VertexOutput;
		output.vTexCoord = position;
		let pos = uniforms.projectionMatrix * uniforms.viewMatrix * vec4<f32>(position, 1.0);
		output.position = vec4<f32>(pos.xy, pos.w, pos.w); // z = w for depth = 1.0
		return output;
	}
)";

const char* skyboxFragWGSL = R"(
	@binding(1) @group(0) var skyboxSampler: sampler;
	@binding(2) @group(0) var skyboxTexture: texture_cube<f32>;

	@fragment
	fn main(@location(0) vTexCoord: vec3<f32>) -> @location(0) vec4<f32> {
		return textureSample(skyboxTexture, skyboxSampler, vTexCoord);
	}
)";

void createSkyboxPipeline() {
	WGPUShaderModule vs = createShader(skyboxVertWGSL);
	WGPUShaderModule fs = createShader(skyboxFragWGSL);

	WGPUVertexAttribute posAttr = {};
	posAttr.format = WGPUVertexFormat_Float32x3;
	posAttr.offset = 0;
	posAttr.shaderLocation = 0;
	WGPUVertexBufferLayout vbl = {};
	vbl.arrayStride = 3 * sizeof(float);
	vbl.attributeCount = 1;
	vbl.attributes = &posAttr;

	WGPUColorTargetState colorTarget = {};
	colorTarget.format = surfaceFormat;
	colorTarget.writeMask = WGPUColorWriteMask_All;

	WGPUFragmentState fragment = {};
	fragment.module = fs;
	fragment.entryPoint = { "main", WGPU_STRLEN };
	fragment.targetCount = 1;
	fragment.targets = &colorTarget;

	WGPUDepthStencilState depthStencil = {};
	depthStencil.format = depthFormat;
	depthStencil.depthWriteEnabled = WGPUOptionalBool_False;
	depthStencil.depthCompare = WGPUCompareFunction_LessEqual;

	WGPURenderPipelineDescriptor desc = {};
	desc.layout = nullptr;
	desc.fragment = &fragment;
	desc.depthStencil = &depthStencil;
	desc.vertex.module = vs;
	desc.vertex.entryPoint = { "main", WGPU_STRLEN };
	desc.vertex.bufferCount = 1;
	desc.vertex.buffers = &vbl;
	desc.multisample.count = 1;
	desc.multisample.mask = 0xFFFFFFFF;
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;

	skyboxPipeline = wgpuDeviceCreateRenderPipeline(device, &desc);
	wgpuShaderModuleRelease(vs);
	wgpuShaderModuleRelease(fs);

	static const float skyboxVertices[] = {
		-1,  1, -1, -1, -1, -1,  1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,
		-1, -1,  1, -1, -1, -1, -1,  1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1,
		 1, -1, -1,  1, -1,  1,  1,  1,  1,  1,  1,  1,  1,  1, -1,  1, -1, -1,
		-1, -1,  1, -1,  1,  1,  1,  1,  1,  1,  1,  1,  1, -1,  1, -1, -1,  1,
		-1,  1, -1,  1,  1, -1,  1,  1,  1,  1,  1,  1, -1,  1,  1, -1,  1, -1,
		-1, -1, -1, -1, -1,  1,  1, -1, -1,  1, -1, -1, -1, -1,  1,  1, -1,  1
	};
	WGPUBufferDescriptor vbDesc = {};
	vbDesc.usage = WGPUBufferUsage_Vertex | WGPUBufferUsage_CopyDst;
	vbDesc.size = sizeof(skyboxVertices);
	skyboxVertexBuf = wgpuDeviceCreateBuffer(device, &vbDesc);
	wgpuQueueWriteBuffer(queue, skyboxVertexBuf, 0, skyboxVertices, sizeof(skyboxVertices));

	WGPUBufferDescriptor ubDesc = {};
	ubDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
	ubDesc.size = 128; // two mat4
	skyboxUniformBuf = wgpuDeviceCreateBuffer(device, &ubDesc);
}

void buildSkyboxTexture() {
	int w = skyboxFaces[0].w, h = skyboxFaces[0].h;
	WGPUTextureDescriptor texDesc = {};
	texDesc.usage = WGPUTextureUsage_TextureBinding | WGPUTextureUsage_CopyDst;
	texDesc.dimension = WGPUTextureDimension_2D;
	texDesc.size = { (uint32_t)w, (uint32_t)h, 6 };
	texDesc.format = WGPUTextureFormat_RGBA8Unorm;
	texDesc.mipLevelCount = 1;
	texDesc.sampleCount = 1;
	WGPUTexture cubeTex = wgpuDeviceCreateTexture(device, &texDesc);

	for (int f = 0; f < 6; f++) {
		WGPUTexelCopyTextureInfo dst = {};
		dst.texture = cubeTex;
		dst.mipLevel = 0;
		dst.origin = { 0, 0, (uint32_t)f };
		dst.aspect = WGPUTextureAspect_All;
		WGPUTexelCopyBufferLayout layout = {};
		layout.offset = 0;
		layout.bytesPerRow = (uint32_t)(w * 4);
		layout.rowsPerImage = (uint32_t)h;
		WGPUExtent3D sz = { (uint32_t)w, (uint32_t)h, 1 };
		wgpuQueueWriteTexture(queue, &dst, skyboxFaces[f].pixels, (size_t)(w * h * 4), &layout, &sz);
		stbi_image_free(skyboxFaces[f].pixels);
		skyboxFaces[f].pixels = nullptr;
	}

	WGPUTextureViewDescriptor viewDesc = {};
	viewDesc.format = WGPUTextureFormat_RGBA8Unorm;
	viewDesc.dimension = WGPUTextureViewDimension_Cube;
	viewDesc.baseMipLevel = 0;
	viewDesc.mipLevelCount = 1;
	viewDesc.baseArrayLayer = 0;
	viewDesc.arrayLayerCount = 6;
	viewDesc.aspect = WGPUTextureAspect_All;
	WGPUTextureView cubeView = wgpuTextureCreateView(cubeTex, &viewDesc);

	WGPUSamplerDescriptor sd = {};
	sd.addressModeU = WGPUAddressMode_ClampToEdge;
	sd.addressModeV = WGPUAddressMode_ClampToEdge;
	sd.addressModeW = WGPUAddressMode_ClampToEdge;
	sd.magFilter = WGPUFilterMode_Linear;
	sd.minFilter = WGPUFilterMode_Linear;
	sd.mipmapFilter = WGPUMipmapFilterMode_Linear;
	sd.lodMinClamp = 0.0f;
	sd.lodMaxClamp = 32.0f;
	sd.maxAnisotropy = 1;
	WGPUSampler sampler = wgpuDeviceCreateSampler(device, &sd);

	WGPUBindGroupEntry entries[3] = {};
	entries[0].binding = 0; entries[0].buffer = skyboxUniformBuf; entries[0].size = 128;
	entries[1].binding = 1; entries[1].sampler = sampler;
	entries[2].binding = 2; entries[2].textureView = cubeView;
	WGPUBindGroupDescriptor bgd = {};
	bgd.layout = wgpuRenderPipelineGetBindGroupLayout(skyboxPipeline, 0);
	bgd.entryCount = 3;
	bgd.entries = entries;
	skyboxBindGroup = wgpuDeviceCreateBindGroup(device, &bgd);

	skyboxReady = true;
}

void onSkyboxFace(void* user, const unsigned char* data, int size) {
	int faceIndex = (int)(intptr_t)user;
	if (!data) return;
	int w, h, comp;
	unsigned char* pixels = stbi_load_from_memory(data, size, &w, &h, &comp, 4);
	if (!pixels) { printf("skybox decode failed face %d\n", faceIndex); return; }
	skyboxFaces[faceIndex].pixels = pixels;
	skyboxFaces[faceIndex].w = w;
	skyboxFaces[faceIndex].h = h;
	skyboxFacesLoaded++;
	if (skyboxFacesLoaded == 6) {
		buildSkyboxTexture();
	}
}

void loadSkybox() {
	const char* base = "https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/";
	const char* faces[6] = { "px.jpg", "nx.jpg", "py.jpg", "ny.jpg", "pz.jpg", "nz.jpg" };
	for (int i = 0; i < 6; i++) {
		static char url[6][256];
		snprintf(url[i], sizeof(url[i]), "%s%s", base, faces[i]);
		fetchURL(url[i], onSkyboxFace, (void*)(intptr_t)i);
	}
}

//****************************************************************************/
// glTF model (CesiumMilkTruck) loaded over the network with cgltf

static const int MAX_JOINTS = 180;

static void mat4_scale(float* m, float x, float y, float z) {
	m[0]*=x; m[1]*=x; m[2]*=x; m[3]*=x;
	m[4]*=y; m[5]*=y; m[6]*=y; m[7]*=y;
	m[8]*=z; m[9]*=z; m[10]*=z; m[11]*=z;
}

const char* mainVertWGSL = R"(
	struct Uniforms {
		modelMatrix: mat4x4<f32>,
		viewMatrix: mat4x4<f32>,
		projectionMatrix: mat4x4<f32>,
		normalMatrix: mat4x4<f32>,
		lightDir: vec4<f32>,
		baseColor: vec4<f32>,
		flags: vec4<u32>
	};
	struct JointMatrices { matrices: array<mat4x4<f32>, 180> };
	@binding(0) @group(0) var<uniform> uniforms: Uniforms;
	@binding(1) @group(0) var<storage, read> jointMatrices: JointMatrices;

	struct VertexInput {
		@location(0) position: vec3<f32>,
		@location(1) normal: vec3<f32>,
		@location(2) texCoord: vec2<f32>,
		@location(3) joints: vec4<u32>,
		@location(4) weights: vec4<f32>
	};
	struct VertexOutput {
		@builtin(position) position: vec4<f32>,
		@location(0) vNormal: vec3<f32>,
		@location(1) vTexCoord: vec2<f32>,
		@location(2) vPosition: vec3<f32>,
		@location(3) vWorldPosition: vec3<f32>
	};

	@vertex
	fn main(input: VertexInput) -> VertexOutput {
		var output: VertexOutput;
		var position = vec4<f32>(input.position, 1.0);
		var normal = input.normal;
		if (uniforms.flags.x == 1u) {
			let skinMatrix =
				input.weights.x * jointMatrices.matrices[input.joints.x] +
				input.weights.y * jointMatrices.matrices[input.joints.y] +
				input.weights.z * jointMatrices.matrices[input.joints.z] +
				input.weights.w * jointMatrices.matrices[input.joints.w];
			position = skinMatrix * position;
			normal = (skinMatrix * vec4<f32>(normal, 0.0)).xyz;
		}
		let worldPosition = uniforms.modelMatrix * position;
		output.vPosition = worldPosition.xyz;
		output.vWorldPosition = worldPosition.xyz;
		output.vNormal = (uniforms.normalMatrix * vec4<f32>(normal, 0.0)).xyz;
		output.vTexCoord = input.texCoord;
		output.position = uniforms.projectionMatrix * uniforms.viewMatrix * worldPosition;
		return output;
	}
)";

const char* mainFragWGSL = R"(
	struct Uniforms {
		modelMatrix: mat4x4<f32>,
		viewMatrix: mat4x4<f32>,
		projectionMatrix: mat4x4<f32>,
		normalMatrix: mat4x4<f32>,
		lightDir: vec4<f32>,
		baseColor: vec4<f32>,
		flags: vec4<u32>
	};
	@binding(0) @group(0) var<uniform> uniforms: Uniforms;
	@binding(2) @group(0) var texSampler: sampler;
	@binding(3) @group(0) var texTexture: texture_2d<f32>;

	struct FragmentInput {
		@location(0) vNormal: vec3<f32>,
		@location(1) vTexCoord: vec2<f32>,
		@location(2) vPosition: vec3<f32>,
		@location(3) vWorldPosition: vec3<f32>
	};

	@fragment
	fn main(input: FragmentInput) -> @location(0) vec4<f32> {
		var normal: vec3<f32>;
		if (uniforms.flags.z == 1u) {
			normal = normalize(input.vNormal);
		} else {
			let ddx = dpdx(input.vWorldPosition);
			let ddy = dpdy(input.vWorldPosition);
			normal = normalize(cross(ddx, ddy));
		}
		let lightDir = normalize(uniforms.lightDir.xyz);
		let diff = max(dot(normal, lightDir), 0.0);
		let ambient = 0.3;
		let lighting = ambient + diff * 0.7;
		var baseColor: vec4<f32>;
		if (uniforms.flags.y == 1u) {
			baseColor = textureSample(texTexture, texSampler, input.vTexCoord);
		} else {
			baseColor = uniforms.baseColor;
		}
		var finalColor = baseColor.rgb * lighting;
		finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));
		return vec4<f32>(finalColor, baseColor.a);
	}
)";

struct Primitive {
	WGPUBuffer posBuf, normalBuf, uvBuf, jointsBuf, weightsBuf, indexBuf;
	uint32_t count;
	bool hasIndices, hasTexture, hasNormals, hasSkinning;
	float baseColor[4];
	WGPUTextureView texView;
	float bboxMin[3], bboxMax[3];
};

struct PrimInstance {
	Primitive* prim;
	WGPUBuffer uniformBuf;
	WGPUBuffer jointBuf;
	WGPUBindGroup bindGroup;
};

struct Node {
	float t[3], r[4], s[3];
	float world[16];
	int meshIndex;
	int skinIndex;
	std::vector<int> children;
	std::vector<PrimInstance> instances;
};

struct Skin {
	std::vector<int> joints;
	std::vector<float> inverseBind;   // joints * 16
	std::vector<float> jointMatrices; // joints * 16 (updated per frame)
};

struct AnimChannel {
	int targetNode;
	int path; // 0=T,1=R,2=S
	int ncomp;
	std::vector<float> times;
	std::vector<float> values;
};

struct Model {
	std::vector<Node> nodes;
	std::vector<std::vector<Primitive>> meshes;
	std::vector<Skin> skins;
	std::vector<int> rootNodes;
	float baseTransform[16];
	std::vector<AnimChannel> channels;
	float animDuration;
	bool ready;
};

struct ModelConfig {
	const char* url;
	float scale;
	float rot[3];
	float pos[3];
	const char* animName; // "" => first animation
};

static ModelConfig gConfigs[] = {
	{ "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf", 0.4f, {0, PI/2, 0}, {0, 0, -2}, "" },
	{ "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf",                          0.05f, {0, PI/2, 0}, {0, 0, 0}, "Run" },
	{ "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf", 1.0f, {0, PI/2, 0}, {0, 0, 3}, "" }
};
static const int gNumConfigs = (int)(sizeof(gConfigs) / sizeof(gConfigs[0]));

std::vector<Model> gModels;

WGPURenderPipeline mainPipeline = nullptr;
WGPUSampler gSampler = nullptr;
WGPUTextureView gDefaultTexView = nullptr;

// Context for the model currently being loaded (models load sequentially).
struct LoadCtx {
	cgltf_data* g;
	char baseUrl[256];
	unsigned char* binCopy;
	int modelIndex;
	std::vector<WGPUTextureView> imageViews; // per glTF image index (null if not loaded)
	std::vector<int> needed;                 // image indices still to fetch
	int loaded;
};
LoadCtx gLoad = {};

// Decorative ground tracks (the truck's tyre ruts) drawn with the main pipeline.
struct GroundTrack {
	WGPUBuffer posBuf, normalBuf, uvBuf, jointsBuf, weightsBuf, indexBuf;
	WGPUBuffer uniformBuf, jointBuf;
	WGPUBindGroup bindGroup;
	float position[3];
	float color[4];
};
std::vector<GroundTrack> gGroundTracks;

WGPUBuffer createDataBuffer(const void* data, size_t bytes, WGPUBufferUsage usage) {
	WGPUBufferDescriptor d = {};
	d.usage = WGPUBufferUsage_CopyDst | usage;
	d.size = bytes;
	WGPUBuffer b = wgpuDeviceCreateBuffer(device, &d);
	wgpuQueueWriteBuffer(queue, b, 0, data, bytes);
	return b;
}

WGPUTextureView createTexture2D(const unsigned char* rgba, int w, int h) {
	WGPUTextureDescriptor td = {};
	td.usage = WGPUTextureUsage_TextureBinding | WGPUTextureUsage_CopyDst;
	td.dimension = WGPUTextureDimension_2D;
	td.size = { (uint32_t)w, (uint32_t)h, 1 };
	td.format = WGPUTextureFormat_RGBA8Unorm;
	td.mipLevelCount = 1;
	td.sampleCount = 1;
	WGPUTexture t = wgpuDeviceCreateTexture(device, &td);
	WGPUTexelCopyTextureInfo dst = {};
	dst.texture = t; dst.origin = { 0, 0, 0 }; dst.aspect = WGPUTextureAspect_All;
	WGPUTexelCopyBufferLayout lay = {};
	lay.bytesPerRow = (uint32_t)(w * 4); lay.rowsPerImage = (uint32_t)h;
	WGPUExtent3D sz = { (uint32_t)w, (uint32_t)h, 1 };
	wgpuQueueWriteTexture(queue, &dst, rgba, (size_t)(w * h * 4), &lay, &sz);
	return wgpuTextureCreateView(t, nullptr);
}

void createMainPipeline() {
	WGPUShaderModule vs = createShader(mainVertWGSL);
	WGPUShaderModule fs = createShader(mainFragWGSL);

	WGPUVertexAttribute aPos = {}; aPos.format = WGPUVertexFormat_Float32x3; aPos.shaderLocation = 0;
	WGPUVertexAttribute aNrm = {}; aNrm.format = WGPUVertexFormat_Float32x3; aNrm.shaderLocation = 1;
	WGPUVertexAttribute aUv  = {}; aUv.format  = WGPUVertexFormat_Float32x2; aUv.shaderLocation = 2;
	WGPUVertexAttribute aJnt = {}; aJnt.format = WGPUVertexFormat_Uint32x4;  aJnt.shaderLocation = 3;
	WGPUVertexAttribute aWgt = {}; aWgt.format = WGPUVertexFormat_Float32x4; aWgt.shaderLocation = 4;
	WGPUVertexBufferLayout vbl[5] = {};
	vbl[0].arrayStride = 12; vbl[0].attributeCount = 1; vbl[0].attributes = &aPos;
	vbl[1].arrayStride = 12; vbl[1].attributeCount = 1; vbl[1].attributes = &aNrm;
	vbl[2].arrayStride = 8;  vbl[2].attributeCount = 1; vbl[2].attributes = &aUv;
	vbl[3].arrayStride = 16; vbl[3].attributeCount = 1; vbl[3].attributes = &aJnt;
	vbl[4].arrayStride = 16; vbl[4].attributeCount = 1; vbl[4].attributes = &aWgt;

	WGPUColorTargetState ct = {};
	ct.format = surfaceFormat;
	ct.writeMask = WGPUColorWriteMask_All;
	WGPUFragmentState fragment = {};
	fragment.module = fs;
	fragment.entryPoint = { "main", WGPU_STRLEN };
	fragment.targetCount = 1;
	fragment.targets = &ct;

	WGPUDepthStencilState ds = {};
	ds.format = depthFormat;
	ds.depthWriteEnabled = WGPUOptionalBool_True;
	ds.depthCompare = WGPUCompareFunction_Less;

	WGPURenderPipelineDescriptor desc = {};
	desc.layout = nullptr;
	desc.fragment = &fragment;
	desc.depthStencil = &ds;
	desc.vertex.module = vs;
	desc.vertex.entryPoint = { "main", WGPU_STRLEN };
	desc.vertex.bufferCount = 5;
	desc.vertex.buffers = vbl;
	desc.multisample.count = 1;
	desc.multisample.mask = 0xFFFFFFFF;
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
	desc.primitive.cullMode = WGPUCullMode_None;
	mainPipeline = wgpuDeviceCreateRenderPipeline(device, &desc);
	wgpuShaderModuleRelease(vs);
	wgpuShaderModuleRelease(fs);

	WGPUSamplerDescriptor sd = {};
	sd.addressModeU = WGPUAddressMode_Repeat;
	sd.addressModeV = WGPUAddressMode_Repeat;
	sd.addressModeW = WGPUAddressMode_Repeat;
	sd.magFilter = WGPUFilterMode_Linear;
	sd.minFilter = WGPUFilterMode_Linear;
	sd.mipmapFilter = WGPUMipmapFilterMode_Linear;
	sd.lodMinClamp = 0.0f; sd.lodMaxClamp = 32.0f; sd.maxAnisotropy = 1;
	gSampler = wgpuDeviceCreateSampler(device, &sd);

	unsigned char white[4] = { 255, 255, 255, 255 };
	gDefaultTexView = createTexture2D(white, 1, 1);
}

void updateHierarchy(Model& m, int idx, const float* parent) {
	Node& node = m.nodes[idx];
	float local[16];
	mat4_from_trs(local, node.t, node.r, node.s);
	mat4_multiply(node.world, parent, local);
	for (int c : node.children) updateHierarchy(m, c, node.world);
}

void updateAnimation(Model& m, float time) {
	if (m.channels.empty() || m.animDuration <= 0.0f) return;
	float t = fmodf(time, m.animDuration);
	for (auto& ch : m.channels) {
		int n = (int)ch.times.size();
		if (n == 0) continue;
		int i0 = 0;
		if (t <= ch.times[0]) i0 = 0;
		else if (t >= ch.times[n - 1]) i0 = n - 1;
		else { while (i0 < n - 1 && ch.times[i0 + 1] < t) i0++; }
		int i1 = (i0 + 1 < n) ? i0 + 1 : i0;
		float t0 = ch.times[i0], t1 = ch.times[i1];
		float f = (t1 > t0) ? (t - t0) / (t1 - t0) : 0.0f;
		Node& node = m.nodes[ch.targetNode];
		const float* v0 = &ch.values[i0 * ch.ncomp];
		const float* v1 = &ch.values[i1 * ch.ncomp];
		if (ch.path == 1) {
			float q[4]; quat_slerp(q, v0, v1, f);
			node.r[0] = q[0]; node.r[1] = q[1]; node.r[2] = q[2]; node.r[3] = q[3];
		} else if (ch.path == 0) {
			for (int k = 0; k < 3; k++) node.t[k] = v0[k] + (v1[k] - v0[k]) * f;
		} else if (ch.path == 2) {
			for (int k = 0; k < 3; k++) node.s[k] = v0[k] + (v1[k] - v0[k]) * f;
		}
	}
}

void updateSkins(Model& m) {
	for (auto& skin : m.skins) {
		int nj = (int)skin.joints.size();
		for (int i = 0; i < nj; i++) {
			const float* jw = m.nodes[skin.joints[i]].world;
			mat4_multiply(&skin.jointMatrices[i * 16], jw, &skin.inverseBind[i * 16]);
		}
	}
}

void computeCameraAll() {
	float mn[3] = {  1e30f,  1e30f,  1e30f };
	float mx[3] = { -1e30f, -1e30f, -1e30f };
	bool any = false;
	for (auto& m : gModels) {
		if (!m.ready) continue;
		for (int root : m.rootNodes) updateHierarchy(m, root, m.baseTransform);
		for (size_t ni = 0; ni < m.nodes.size(); ni++) {
			Node& nd = m.nodes[ni];
			if (nd.meshIndex < 0) continue;
			for (auto& prim : m.meshes[nd.meshIndex]) {
				for (int c = 0; c < 8; c++) {
					float p[3] = {
						(c & 1) ? prim.bboxMax[0] : prim.bboxMin[0],
						(c & 2) ? prim.bboxMax[1] : prim.bboxMin[1],
						(c & 4) ? prim.bboxMax[2] : prim.bboxMin[2]
					};
					const float* w = nd.world;
					float tx = w[0]*p[0] + w[4]*p[1] + w[8]*p[2] + w[12];
					float ty = w[1]*p[0] + w[5]*p[1] + w[9]*p[2] + w[13];
					float tz = w[2]*p[0] + w[6]*p[1] + w[10]*p[2] + w[14];
					if (tx < mn[0]) mn[0] = tx; if (tx > mx[0]) mx[0] = tx;
					if (ty < mn[1]) mn[1] = ty; if (ty > mx[1]) mx[1] = ty;
					if (tz < mn[2]) mn[2] = tz; if (tz > mx[2]) mx[2] = tz;
					any = true;
				}
			}
		}
	}
	if (!any) return;
	extern float gCenter[3];
	extern float gCameraDistance;
	gCenter[0] = (mn[0] + mx[0]) * 0.5f;
	gCenter[1] = (mn[1] + mx[1]) * 0.5f;
	gCenter[2] = (mn[2] + mx[2]) * 0.5f;
	float ex = mx[0]-mn[0], ey = mx[1]-mn[1], ez = mx[2]-mn[2];
	float maxSize = ex; if (ey > maxSize) maxSize = ey; if (ez > maxSize) maxSize = ez;
	gCameraDistance = maxSize * 1.5f;
}

void loadModelIndex(int i); // fwd decl

void buildCurrentModel() {
	cgltf_data* g = gLoad.g;
	ModelConfig& cfg = gConfigs[gLoad.modelIndex];
	Model& M = gModels[gLoad.modelIndex];

	M.meshes.resize(g->meshes_count);
	for (size_t mi = 0; mi < g->meshes_count; mi++) {
		cgltf_mesh* mesh = &g->meshes[mi];
		for (size_t pi = 0; pi < mesh->primitives_count; pi++) {
			cgltf_primitive* p = &mesh->primitives[pi];
			Primitive prim = {};
			cgltf_accessor *posA = nullptr, *nrmA = nullptr, *uvA = nullptr, *jntA = nullptr, *wgtA = nullptr;
			for (size_t a = 0; a < p->attributes_count; a++) {
				cgltf_attribute* at = &p->attributes[a];
				if (at->type == cgltf_attribute_type_position) posA = at->data;
				else if (at->type == cgltf_attribute_type_normal) nrmA = at->data;
				else if (at->type == cgltf_attribute_type_texcoord && at->index == 0) uvA = at->data;
				else if (at->type == cgltf_attribute_type_joints && at->index == 0) jntA = at->data;
				else if (at->type == cgltf_attribute_type_weights && at->index == 0) wgtA = at->data;
			}
			size_t vcount = posA ? posA->count : 0;
			std::vector<float> pos(vcount * 3, 0.0f);
			if (posA) cgltf_accessor_unpack_floats(posA, pos.data(), vcount * 3);
			for (int k = 0; k < 3; k++) { prim.bboxMin[k] = 1e30f; prim.bboxMax[k] = -1e30f; }
			for (size_t v = 0; v < vcount; v++)
				for (int k = 0; k < 3; k++) {
					float val = pos[v * 3 + k];
					if (val < prim.bboxMin[k]) prim.bboxMin[k] = val;
					if (val > prim.bboxMax[k]) prim.bboxMax[k] = val;
				}
			prim.posBuf = createDataBuffer(pos.data(), pos.size() * 4, WGPUBufferUsage_Vertex);

			std::vector<float> nrm(vcount * 3, 0.0f);
			if (nrmA) { cgltf_accessor_unpack_floats(nrmA, nrm.data(), vcount * 3); prim.hasNormals = true; }
			prim.normalBuf = createDataBuffer(nrm.data(), nrm.size() * 4, WGPUBufferUsage_Vertex);

			std::vector<float> uv(vcount * 2, 0.0f);
			if (uvA) cgltf_accessor_unpack_floats(uvA, uv.data(), vcount * 2);
			prim.uvBuf = createDataBuffer(uv.data(), uv.size() * 4, WGPUBufferUsage_Vertex);

			std::vector<uint32_t> joints(vcount * 4, 0u);
			std::vector<float> weights(vcount * 4, 0.0f);
			if (jntA && wgtA) {
				prim.hasSkinning = true;
				for (size_t v = 0; v < vcount; v++) {
					cgltf_uint tmp[4] = { 0, 0, 0, 0 };
					cgltf_accessor_read_uint(jntA, v, tmp, 4);
					for (int k = 0; k < 4; k++) joints[v * 4 + k] = tmp[k];
				}
				cgltf_accessor_unpack_floats(wgtA, weights.data(), vcount * 4);
			}
			prim.jointsBuf = createDataBuffer(joints.data(), joints.size() * 4, WGPUBufferUsage_Vertex);
			prim.weightsBuf = createDataBuffer(weights.data(), weights.size() * 4, WGPUBufferUsage_Vertex);

			if (p->indices) {
				size_t ic = p->indices->count;
				std::vector<uint32_t> idx(ic);
				for (size_t k = 0; k < ic; k++) idx[k] = (uint32_t)cgltf_accessor_read_index(p->indices, k);
				prim.indexBuf = createDataBuffer(idx.data(), idx.size() * 4, WGPUBufferUsage_Index);
				prim.count = (uint32_t)ic;
				prim.hasIndices = true;
			} else {
				prim.count = (uint32_t)vcount;
				prim.hasIndices = false;
			}

			prim.baseColor[0] = prim.baseColor[1] = prim.baseColor[2] = prim.baseColor[3] = 1.0f;
			prim.hasTexture = false;
			prim.texView = gDefaultTexView;
			if (p->material && p->material->has_pbr_metallic_roughness) {
				cgltf_pbr_metallic_roughness* pbr = &p->material->pbr_metallic_roughness;
				for (int k = 0; k < 4; k++) prim.baseColor[k] = pbr->base_color_factor[k];
				cgltf_texture* tex = pbr->base_color_texture.texture;
				if (tex && tex->image) {
					int imgIdx = (int)(tex->image - g->images);
					if (imgIdx >= 0 && imgIdx < (int)gLoad.imageViews.size() && gLoad.imageViews[imgIdx]) {
						prim.hasTexture = true;
						prim.texView = gLoad.imageViews[imgIdx];
					}
				}
			}
			M.meshes[mi].push_back(prim);
		}
	}

	M.nodes.resize(g->nodes_count);
	for (size_t ni = 0; ni < g->nodes_count; ni++) {
		cgltf_node* n = &g->nodes[ni];
		Node& nd = M.nodes[ni];
		nd.t[0] = nd.t[1] = nd.t[2] = 0.0f;
		nd.r[0] = nd.r[1] = nd.r[2] = 0.0f; nd.r[3] = 1.0f;
		nd.s[0] = nd.s[1] = nd.s[2] = 1.0f;
		if (n->has_translation) for (int k = 0; k < 3; k++) nd.t[k] = n->translation[k];
		if (n->has_rotation)    for (int k = 0; k < 4; k++) nd.r[k] = n->rotation[k];
		if (n->has_scale)       for (int k = 0; k < 3; k++) nd.s[k] = n->scale[k];
		nd.meshIndex = n->mesh ? (int)(n->mesh - g->meshes) : -1;
		nd.skinIndex = n->skin ? (int)(n->skin - g->skins) : -1;
		for (size_t c = 0; c < n->children_count; c++)
			nd.children.push_back((int)(n->children[c] - g->nodes));
	}

	M.skins.resize(g->skins_count);
	for (size_t si = 0; si < g->skins_count; si++) {
		cgltf_skin* sk = &g->skins[si];
		Skin& S = M.skins[si];
		S.joints.resize(sk->joints_count);
		for (size_t j = 0; j < sk->joints_count; j++) S.joints[j] = (int)(sk->joints[j] - g->nodes);
		S.inverseBind.assign(sk->joints_count * 16, 0.0f);
		S.jointMatrices.assign(sk->joints_count * 16, 0.0f);
		if (sk->inverse_bind_matrices) {
			for (size_t j = 0; j < sk->joints_count; j++)
				cgltf_accessor_read_float(sk->inverse_bind_matrices, j, &S.inverseBind[j * 16], 16);
		} else {
			for (size_t j = 0; j < sk->joints_count; j++) mat4_identity(&S.inverseBind[j * 16]);
		}
	}

	for (size_t ni = 0; ni < M.nodes.size(); ni++) {
		Node& nd = M.nodes[ni];
		if (nd.meshIndex < 0) continue;
		for (auto& prim : M.meshes[nd.meshIndex]) {
			PrimInstance inst = {};
			inst.prim = &prim;
			WGPUBufferDescriptor ud = {};
			ud.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
			ud.size = 304;
			inst.uniformBuf = wgpuDeviceCreateBuffer(device, &ud);
			WGPUBufferDescriptor jd = {};
			jd.usage = WGPUBufferUsage_Storage | WGPUBufferUsage_CopyDst;
			jd.size = MAX_JOINTS * 64;
			inst.jointBuf = wgpuDeviceCreateBuffer(device, &jd);

			WGPUBindGroupEntry e[4] = {};
			e[0].binding = 0; e[0].buffer = inst.uniformBuf; e[0].size = 304;
			e[1].binding = 1; e[1].buffer = inst.jointBuf; e[1].size = MAX_JOINTS * 64;
			e[2].binding = 2; e[2].sampler = gSampler;
			e[3].binding = 3; e[3].textureView = prim.texView;
			WGPUBindGroupDescriptor bgd = {};
			bgd.layout = wgpuRenderPipelineGetBindGroupLayout(mainPipeline, 0);
			bgd.entryCount = 4;
			bgd.entries = e;
			inst.bindGroup = wgpuDeviceCreateBindGroup(device, &bgd);
			nd.instances.push_back(inst);
		}
	}

	cgltf_scene* scene = g->scene ? g->scene : (g->scenes_count ? &g->scenes[0] : nullptr);
	if (scene) for (size_t i = 0; i < scene->nodes_count; i++)
		M.rootNodes.push_back((int)(scene->nodes[i] - g->nodes));

	mat4_identity(M.baseTransform);
	mat4_translate(M.baseTransform, cfg.pos[0], cfg.pos[1], cfg.pos[2]);
	mat4_rotate(M.baseTransform, cfg.rot[1], 0.0f, 1.0f, 0.0f);
	mat4_rotate(M.baseTransform, cfg.rot[0], 1.0f, 0.0f, 0.0f);
	mat4_rotate(M.baseTransform, cfg.rot[2], 0.0f, 0.0f, 1.0f);
	mat4_scale(M.baseTransform, cfg.scale, cfg.scale, cfg.scale);

	M.animDuration = 0.0f;
	if (g->animations_count > 0) {
		int chosen = 0;
		if (cfg.animName && cfg.animName[0]) {
			for (size_t a = 0; a < g->animations_count; a++)
				if (g->animations[a].name && strcmp(g->animations[a].name, cfg.animName) == 0) { chosen = (int)a; break; }
		}
		cgltf_animation* anim = &g->animations[chosen];
		for (size_t c = 0; c < anim->channels_count; c++) {
			cgltf_animation_channel* ch = &anim->channels[c];
			if (!ch->target_node || !ch->sampler) continue;
			AnimChannel ac = {};
			ac.targetNode = (int)(ch->target_node - g->nodes);
			ac.path = (ch->target_path == cgltf_animation_path_type_rotation) ? 1 :
			          (ch->target_path == cgltf_animation_path_type_scale) ? 2 : 0;
			cgltf_accessor* in = ch->sampler->input;
			cgltf_accessor* out = ch->sampler->output;
			int nk = (int)in->count;
			ac.times.resize(nk);
			for (int k = 0; k < nk; k++) {
				float tt = 0.0f; cgltf_accessor_read_float(in, k, &tt, 1);
				ac.times[k] = tt;
				if (tt > M.animDuration) M.animDuration = tt;
			}
			ac.ncomp = (int)cgltf_num_components(out->type);
			ac.values.resize((size_t)nk * ac.ncomp);
			for (int k = 0; k < nk; k++)
				cgltf_accessor_read_float(out, k, &ac.values[(size_t)k * ac.ncomp], ac.ncomp);
			M.channels.push_back(ac);
		}
	}

	M.ready = true;
	cgltf_free(g);
	free(gLoad.binCopy);
	gLoad.binCopy = nullptr;
	gLoad.g = nullptr;

	computeCameraAll();

	if (gLoad.modelIndex + 1 < gNumConfigs) loadModelIndex(gLoad.modelIndex + 1);
}

void onImage(void* user, const unsigned char* data, int size) {
	int imgIdx = (int)(intptr_t)user;
	if (data) {
		int w, h, comp;
		unsigned char* px = stbi_load_from_memory(data, size, &w, &h, &comp, 4);
		if (px) { gLoad.imageViews[imgIdx] = createTexture2D(px, w, h); stbi_image_free(px); }
	}
	gLoad.loaded++;
	if (gLoad.loaded >= (int)gLoad.needed.size()) buildCurrentModel();
}

void onBin(void* /*user*/, const unsigned char* data, int size) {
	if (!data) { printf("bin fetch failed\n"); return; }
	cgltf_data* g = gLoad.g;
	gLoad.binCopy = (unsigned char*)malloc(size);
	memcpy(gLoad.binCopy, data, size);
	g->buffers[0].data = gLoad.binCopy;
	g->buffers[0].size = size;

	// Collect the unique base-color image indices that need fetching.
	gLoad.imageViews.assign(g->images_count, nullptr);
	gLoad.needed.clear();
	std::vector<char> mark(g->images_count, 0);
	for (size_t mi = 0; mi < g->meshes_count; mi++)
		for (size_t pi = 0; pi < g->meshes[mi].primitives_count; pi++) {
			cgltf_material* mat = g->meshes[mi].primitives[pi].material;
			if (mat && mat->has_pbr_metallic_roughness) {
				cgltf_texture* tx = mat->pbr_metallic_roughness.base_color_texture.texture;
				if (tx && tx->image) {
					int idx = (int)(tx->image - g->images);
					if (idx >= 0 && idx < (int)g->images_count && !mark[idx]) { mark[idx] = 1; gLoad.needed.push_back(idx); }
				}
			}
		}

	gLoad.loaded = 0;
	if (gLoad.needed.empty()) { buildCurrentModel(); return; }
	for (int idx : gLoad.needed) {
		const char* uri = g->images[idx].uri;
		if (!uri) { gLoad.loaded++; continue; }
		char imgUrl[600];
		snprintf(imgUrl, sizeof(imgUrl), "%s%s", gLoad.baseUrl, uri);
		fetchURL(imgUrl, onImage, (void*)(intptr_t)idx);
	}
	if (gLoad.loaded >= (int)gLoad.needed.size()) buildCurrentModel(); // all uris were null
}

void onGltf(void* /*user*/, const unsigned char* data, int size) {
	if (!data) { printf("gltf fetch failed\n"); return; }
	cgltf_options opt = {};
	cgltf_data* g = nullptr;
	if (cgltf_parse(&opt, data, size, &g) != cgltf_result_success) {
		printf("gltf parse failed\n"); return;
	}
	gLoad.g = g;
	const char* binUri = (g->buffers_count > 0) ? g->buffers[0].uri : nullptr;
	if (!binUri) { printf("no bin uri\n"); return; }
	char binUrl[600];
	snprintf(binUrl, sizeof(binUrl), "%s%s", gLoad.baseUrl, binUri);
	fetchURL(binUrl, onBin, nullptr);
}

void loadModelIndex(int i) {
	gLoad.modelIndex = i;
	gLoad.g = nullptr;
	gLoad.binCopy = nullptr;
	gLoad.loaded = 0;
	gLoad.imageViews.clear();
	gLoad.needed.clear();
	const char* url = gConfigs[i].url;
	const char* slash = strrchr(url, '/');
	int n = slash ? (int)(slash - url + 1) : 0;
	memcpy(gLoad.baseUrl, url, n);
	gLoad.baseUrl[n] = '\0';
	fetchURL(url, onGltf, nullptr);
}

void loadModels() {
	gModels.resize(gNumConfigs);
	loadModelIndex(0);
}

void drawModel(WGPURenderPassEncoder pass, const float* view, const float* projection, float time) {
	bool anyReady = false;
	for (auto& m : gModels) if (m.ready) { anyReady = true; break; }
	if (!anyReady) return;

	wgpuRenderPassEncoderSetPipeline(pass, mainPipeline);
	for (auto& M : gModels) {
		if (!M.ready) continue;
		updateAnimation(M, time);
		for (int root : M.rootNodes) updateHierarchy(M, root, M.baseTransform);
		updateSkins(M);
		for (size_t ni = 0; ni < M.nodes.size(); ni++) {
			Node& nd = M.nodes[ni];
			if (nd.meshIndex < 0) continue;
			Skin* nodeSkin = (nd.skinIndex >= 0 && nd.skinIndex < (int)M.skins.size()) ? &M.skins[nd.skinIndex] : nullptr;
			for (auto& inst : nd.instances) {
				Primitive* prim = inst.prim;
				bool skinned = prim->hasSkinning && nodeSkin;
				float modelMatrix[16];
				if (skinned) mat4_identity(modelMatrix);
				else memcpy(modelMatrix, nd.world, sizeof(modelMatrix));
				float invM[16], normalMatrix[16];
				mat4_invert(invM, modelMatrix);
				mat4_transpose(normalMatrix, invM);

				unsigned char buf[304];
				float* f = (float*)buf;
				memcpy(f + 0,  modelMatrix, 64);
				memcpy(f + 16, view, 64);
				memcpy(f + 32, projection, 64);
				memcpy(f + 48, normalMatrix, 64);
				f[64] = 1.0f; f[65] = 1.0f; f[66] = 1.0f; f[67] = 0.0f;
				f[68] = prim->baseColor[0]; f[69] = prim->baseColor[1];
				f[70] = prim->baseColor[2]; f[71] = prim->baseColor[3];
				uint32_t* u = (uint32_t*)buf;
				u[72] = skinned ? 1u : 0u;
				u[73] = prim->hasTexture ? 1u : 0u;
				u[74] = prim->hasNormals ? 1u : 0u;
				u[75] = 0u;
				wgpuQueueWriteBuffer(queue, inst.uniformBuf, 0, buf, 304);

				if (skinned) {
					int nj = (int)nodeSkin->joints.size();
					if (nj > MAX_JOINTS) nj = MAX_JOINTS;
					wgpuQueueWriteBuffer(queue, inst.jointBuf, 0, nodeSkin->jointMatrices.data(), (size_t)nj * 64);
				}

				wgpuRenderPassEncoderSetBindGroup(pass, 0, inst.bindGroup, 0, nullptr);
				wgpuRenderPassEncoderSetVertexBuffer(pass, 0, prim->posBuf, 0, WGPU_WHOLE_SIZE);
				wgpuRenderPassEncoderSetVertexBuffer(pass, 1, prim->normalBuf, 0, WGPU_WHOLE_SIZE);
				wgpuRenderPassEncoderSetVertexBuffer(pass, 2, prim->uvBuf, 0, WGPU_WHOLE_SIZE);
				wgpuRenderPassEncoderSetVertexBuffer(pass, 3, prim->jointsBuf, 0, WGPU_WHOLE_SIZE);
				wgpuRenderPassEncoderSetVertexBuffer(pass, 4, prim->weightsBuf, 0, WGPU_WHOLE_SIZE);
				if (prim->hasIndices) {
					wgpuRenderPassEncoderSetIndexBuffer(pass, prim->indexBuf, WGPUIndexFormat_Uint32, 0, WGPU_WHOLE_SIZE);
					wgpuRenderPassEncoderDrawIndexed(pass, prim->count, 1, 0, 0, 0);
				} else {
					wgpuRenderPassEncoderDraw(pass, prim->count, 1, 0, 0);
				}
			}
		}
	}
}

void createGroundTracks() {
	const float width = 100.0f, height = 0.1f;
	float positions[] = {
		-width / 2, 0, 0,   width / 2, 0, 0,   width / 2, 0, height,   -width / 2, 0, height
	};
	float normals[]  = { 0,1,0, 0,1,0, 0,1,0, 0,1,0 };
	float uvs[]      = { 0,0, 1,0, 1,1, 0,1 };
	uint32_t indices[] = { 0,1,2, 0,2,3 };
	uint32_t joints[16] = {0};
	float weights[16] = {0};
	float trackZ[2] = { -1.6f, -2.35f };

	for (int i = 0; i < 2; i++) {
		GroundTrack t = {};
		t.position[0] = -49.5f; t.position[1] = 0.0f; t.position[2] = trackZ[i];
		t.color[0] = t.color[1] = t.color[2] = t.color[3] = 1.0f;
		t.posBuf     = createDataBuffer(positions, sizeof(positions), WGPUBufferUsage_Vertex);
		t.normalBuf  = createDataBuffer(normals,   sizeof(normals),   WGPUBufferUsage_Vertex);
		t.uvBuf      = createDataBuffer(uvs,       sizeof(uvs),       WGPUBufferUsage_Vertex);
		t.jointsBuf  = createDataBuffer(joints,    sizeof(joints),    WGPUBufferUsage_Vertex);
		t.weightsBuf = createDataBuffer(weights,   sizeof(weights),   WGPUBufferUsage_Vertex);
		t.indexBuf   = createDataBuffer(indices,   sizeof(indices),   WGPUBufferUsage_Index);

		WGPUBufferDescriptor ud = {};
		ud.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
		ud.size = 304;
		t.uniformBuf = wgpuDeviceCreateBuffer(device, &ud);
		WGPUBufferDescriptor jd = {};
		jd.usage = WGPUBufferUsage_Storage | WGPUBufferUsage_CopyDst;
		jd.size = MAX_JOINTS * 64;
		t.jointBuf = wgpuDeviceCreateBuffer(device, &jd);

		WGPUBindGroupEntry e[4] = {};
		e[0].binding = 0; e[0].buffer = t.uniformBuf; e[0].size = 304;
		e[1].binding = 1; e[1].buffer = t.jointBuf; e[1].size = MAX_JOINTS * 64;
		e[2].binding = 2; e[2].sampler = gSampler;
		e[3].binding = 3; e[3].textureView = gDefaultTexView;
		WGPUBindGroupDescriptor bgd = {};
		bgd.layout = wgpuRenderPipelineGetBindGroupLayout(mainPipeline, 0);
		bgd.entryCount = 4;
		bgd.entries = e;
		t.bindGroup = wgpuDeviceCreateBindGroup(device, &bgd);
		gGroundTracks.push_back(t);
	}
}

void drawGroundTracks(WGPURenderPassEncoder pass, const float* view, const float* projection) {
	if (gGroundTracks.empty()) return;
	wgpuRenderPassEncoderSetPipeline(pass, mainPipeline);
	for (auto& t : gGroundTracks) {
		float modelMatrix[16];
		mat4_identity(modelMatrix);
		mat4_translate(modelMatrix, t.position[0], t.position[1], t.position[2]);
		float invM[16], normalMatrix[16];
		mat4_invert(invM, modelMatrix);
		mat4_transpose(normalMatrix, invM);

		unsigned char buf[304];
		float* f = (float*)buf;
		memcpy(f + 0,  modelMatrix, 64);
		memcpy(f + 16, view, 64);
		memcpy(f + 32, projection, 64);
		memcpy(f + 48, normalMatrix, 64);
		f[64] = 1.0f; f[65] = 1.0f; f[66] = 1.0f; f[67] = 0.0f;
		f[68] = t.color[0]; f[69] = t.color[1]; f[70] = t.color[2]; f[71] = t.color[3];
		uint32_t* u = (uint32_t*)buf;
		u[72] = 0u; u[73] = 0u; u[74] = 1u; u[75] = 0u;
		wgpuQueueWriteBuffer(queue, t.uniformBuf, 0, buf, 304);

		wgpuRenderPassEncoderSetBindGroup(pass, 0, t.bindGroup, 0, nullptr);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 0, t.posBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 1, t.normalBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 2, t.uvBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 3, t.jointsBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 4, t.weightsBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetIndexBuffer(pass, t.indexBuf, WGPUIndexFormat_Uint32, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderDrawIndexed(pass, 6, 1, 0, 0, 0);
	}
}

//****************************************************************************/
// Render

float gCenter[3] = { 0, 0, 0 };
float gCameraDistance = 5.0f;

bool redraw() {
	uint32_t winW = (uint32_t)canvas_get_width();
	uint32_t winH = (uint32_t)canvas_get_height();
	if (winW != curW || winH != curH) {
		configureSurface(winW, winH);
	}

	float time = (float)(emscripten_get_now() / 1000.0);
	float aspect = (float)curW / (float)curH;

	float projection[16];
	mat4_perspective(projection, PI / 4.0f, aspect, gCameraDistance * 0.01f, gCameraDistance * 10.0f);

	float eye[3] = {
		gCenter[0] - sinf(time * 0.5f) * gCameraDistance,
		gCenter[1] + gCameraDistance * 0.3f,
		gCenter[2] + cosf(time * 0.5f) * gCameraDistance
	};
	float up[3] = { 0, 1, 0 };
	float view[16];
	mat4_lookat(view, eye, gCenter, up);

	WGPUSurfaceTexture surfaceTexture;
	wgpuSurfaceGetCurrentTexture(surface, &surfaceTexture);
	WGPUTextureView backBufView = wgpuTextureCreateView(surfaceTexture.texture, nullptr);
	ensureDepth(wgpuTextureGetWidth(surfaceTexture.texture), wgpuTextureGetHeight(surfaceTexture.texture));

	WGPURenderPassColorAttachment colorDesc = {};
	colorDesc.view = backBufView;
	colorDesc.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
	colorDesc.loadOp = WGPULoadOp_Clear;
	colorDesc.storeOp = WGPUStoreOp_Store;
	colorDesc.clearValue = { 0.2f, 0.2f, 0.2f, 1.0f };

	WGPURenderPassDepthStencilAttachment depthAttach = {};
	depthAttach.view = depthView;
	depthAttach.depthLoadOp = WGPULoadOp_Clear;
	depthAttach.depthStoreOp = WGPUStoreOp_Store;
	depthAttach.depthClearValue = 1.0f;

	WGPURenderPassDescriptor rp = {};
	rp.colorAttachmentCount = 1;
	rp.colorAttachments = &colorDesc;
	rp.depthStencilAttachment = &depthAttach;

	WGPUCommandEncoder encoder = wgpuDeviceCreateCommandEncoder(device, nullptr);
	WGPURenderPassEncoder pass = wgpuCommandEncoderBeginRenderPass(encoder, &rp);

	if (skyboxReady) {
		float skyboxView[16];
		for (int i = 0; i < 16; i++) skyboxView[i] = view[i];
		skyboxView[12] = 0; skyboxView[13] = 0; skyboxView[14] = 0;
		float skyboxUniforms[32];
		for (int i = 0; i < 16; i++) skyboxUniforms[i] = projection[i];
		for (int i = 0; i < 16; i++) skyboxUniforms[16 + i] = skyboxView[i];
		wgpuQueueWriteBuffer(queue, skyboxUniformBuf, 0, skyboxUniforms, sizeof(skyboxUniforms));

		wgpuRenderPassEncoderSetPipeline(pass, skyboxPipeline);
		wgpuRenderPassEncoderSetBindGroup(pass, 0, skyboxBindGroup, 0, nullptr);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 0, skyboxVertexBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderDraw(pass, 36, 1, 0, 0);
	}

	drawGroundTracks(pass, view, projection);
	drawModel(pass, view, projection, time);

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

EM_BOOL em_redraw(double /*t*/, void* /*u*/) { return redraw(); }

//****************************************************************************/

void start() {
	queue = wgpuDeviceGetQueue(device);
	createSurface();
	createSkyboxPipeline();
	createMainPipeline();
	createGroundTracks();
	loadSkybox();
	loadModels();
	emscripten_request_animation_frame_loop(em_redraw, nullptr);
}

void onDeviceRequestEnded(WGPURequestDeviceStatus status, WGPUDevice dev, WGPUStringView message, void*, void*) {
	if (status != WGPURequestDeviceStatus_Success) {
		printf("Failed to get a WebGPU device: %.*s\n", (int)message.length, message.data);
		return;
	}
	device = dev;
	start();
}

void onAdapterRequestEnded(WGPURequestAdapterStatus status, WGPUAdapter adapter, WGPUStringView message, void*, void*) {
	if (status != WGPURequestAdapterStatus_Success) {
		printf("Failed to get a WebGPU adapter: %.*s\n", (int)message.length, message.data);
		return;
	}
	WGPUDeviceDescriptor deviceDesc = {};
	WGPURequestDeviceCallbackInfo cb = {};
	cb.mode = WGPUCallbackMode_AllowSpontaneous;
	cb.callback = onDeviceRequestEnded;
	wgpuAdapterRequestDevice(adapter, &deviceDesc, cb);
}

int main() {
	instance = wgpuCreateInstance(nullptr);
	WGPURequestAdapterCallbackInfo cb = {};
	cb.mode = WGPUCallbackMode_AllowSpontaneous;
	cb.callback = onAdapterRequestEnded;
	wgpuInstanceRequestAdapter(instance, nullptr, cb);
	return 0;
}
