// forked from https://github.com/cwoffenden/hello-webgpu

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

#include "earth_jpg.h"

static const float PI = 3.14159265358979323846f;

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
	struct HandleImpl {} DUMMY;

	EM_BOOL em_redraw(double /*time*/, void *userData) {
		window::Redraw redraw = (window::Redraw)userData;
		return redraw();
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

static void mat4_lookat(float* m, const float* eye, const float* center, const float* up) {
	float z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
	float zl = sqrtf(z0 * z0 + z1 * z1 + z2 * z2);
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
// Geometry generation (replaces the manifold-3d primitives used by the JS sample)

struct Geometry {
	std::vector<float> positions; // xyz
	std::vector<float> uvs;       // uv
};

static void pushV(Geometry& g, float x, float y, float z, float u, float v) {
	g.positions.push_back(x); g.positions.push_back(y); g.positions.push_back(z);
	g.uvs.push_back(u); g.uvs.push_back(v);
}

static void sphericalUV(float x, float y, float z, float& u, float& v) {
	float len = sqrtf(x * x + y * y + z * z);
	if (len == 0.0f) { u = 0.5f; v = 0.5f; return; }
	float nx = x / len, ny = y / len, nz = z / len;
	if (ny < -1.0f) ny = -1.0f; if (ny > 1.0f) ny = 1.0f;
	u = 0.5f - atan2f(nz, nx) / (2.0f * PI);
	v = 0.5f - asinf(ny) / PI;
}

static Geometry createPlane(float width, float height, int segments) {
	Geometry g;
	float hw = width / 2.0f, hh = height / 2.0f;
	float segW = width / segments, segH = height / segments;
	for (int j = 0; j < segments; j++) {
		for (int i = 0; i < segments; i++) {
			float x0 = -hw + i * segW, x1 = x0 + segW;
			float y0 = -hh + j * segH, y1 = y0 + segH;
			float u0 = (float)i / segments, u1 = (float)(i + 1) / segments;
			float v0 = (float)j / segments, v1 = (float)(j + 1) / segments;
			pushV(g, x0, y0, 0, u0, v0); pushV(g, x1, y0, 0, u1, v0); pushV(g, x1, y1, 0, u1, v1);
			pushV(g, x0, y0, 0, u0, v0); pushV(g, x1, y1, 0, u1, v1); pushV(g, x0, y1, 0, u0, v1);
		}
	}
	return g;
}

static Geometry createCircle(float radius, int segments) {
	Geometry g;
	for (int i = 0; i < segments; i++) {
		float a0 = ((float)i / segments) * PI * 2.0f;
		float a1 = ((float)(i + 1) / segments) * PI * 2.0f;
		float x0 = cosf(a0) * radius, z0 = sinf(a0) * radius;
		float x1 = cosf(a1) * radius, z1 = sinf(a1) * radius;
		pushV(g, 0, 0, 0, 0.5f, 0.5f);
		pushV(g, x0, 0, z0, (x0 / radius + 1) / 2, (z0 / radius + 1) / 2);
		pushV(g, x1, 0, z1, (x1 / radius + 1) / 2, (z1 / radius + 1) / 2);
	}
	return g;
}

static Geometry createCube(float size) {
	Geometry g;
	float h = size / 2.0f;
	float v[8][3] = {
		{-h,-h,-h},{ h,-h,-h},{ h, h,-h},{-h, h,-h},
		{-h,-h, h},{ h,-h, h},{ h, h, h},{-h, h, h}
	};
	int faces[6][4] = {
		{4,5,6,7}, // front  (z+)
		{1,0,3,2}, // back   (z-)
		{5,1,2,6}, // right  (x+)
		{0,4,7,3}, // left   (x-)
		{7,6,2,3}, // top    (y+)
		{0,1,5,4}  // bottom (y-)
	};
	float fuv[4][2] = { {0,0},{1,0},{1,1},{0,1} };
	for (int f = 0; f < 6; f++) {
		int a = faces[f][0], b = faces[f][1], c = faces[f][2], d = faces[f][3];
		pushV(g, v[a][0],v[a][1],v[a][2], fuv[0][0],fuv[0][1]);
		pushV(g, v[b][0],v[b][1],v[b][2], fuv[1][0],fuv[1][1]);
		pushV(g, v[c][0],v[c][1],v[c][2], fuv[2][0],fuv[2][1]);
		pushV(g, v[a][0],v[a][1],v[a][2], fuv[0][0],fuv[0][1]);
		pushV(g, v[c][0],v[c][1],v[c][2], fuv[2][0],fuv[2][1]);
		pushV(g, v[d][0],v[d][1],v[d][2], fuv[3][0],fuv[3][1]);
	}
	return g;
}

static Geometry createSphere(float radius, int segments) {
	Geometry g;
	int stacks = segments, slices = segments;
	for (int i = 0; i < stacks; i++) {
		float phi0 = PI * (float)i / stacks;       // 0..PI (latitude)
		float phi1 = PI * (float)(i + 1) / stacks;
		for (int j = 0; j < slices; j++) {
			float th0 = 2.0f * PI * (float)j / slices;       // longitude
			float th1 = 2.0f * PI * (float)(j + 1) / slices;
			float p00x = radius*sinf(phi0)*cosf(th0), p00y = radius*cosf(phi0), p00z = radius*sinf(phi0)*sinf(th0);
			float p01x = radius*sinf(phi0)*cosf(th1), p01y = radius*cosf(phi0), p01z = radius*sinf(phi0)*sinf(th1);
			float p10x = radius*sinf(phi1)*cosf(th0), p10y = radius*cosf(phi1), p10z = radius*sinf(phi1)*sinf(th0);
			float p11x = radius*sinf(phi1)*cosf(th1), p11y = radius*cosf(phi1), p11z = radius*sinf(phi1)*sinf(th1);
			float u0 = (float)j / slices, u1 = (float)(j + 1) / slices;
			float v0 = (float)i / stacks, v1 = (float)(i + 1) / stacks;
			pushV(g, p00x,p00y,p00z, u0,v0); pushV(g, p10x,p10y,p10z, u0,v1); pushV(g, p11x,p11y,p11z, u1,v1);
			pushV(g, p00x,p00y,p00z, u0,v0); pushV(g, p11x,p11y,p11z, u1,v1); pushV(g, p01x,p01y,p01z, u1,v0);
		}
	}
	return g;
}

// Y-axis cylinder/cone, centered at the origin (rBottom at y=-h/2, rTop at y=+h/2).
static Geometry createCylinder(float height, float rBottom, float rTop, int segments) {
	Geometry g;
	float hy = height / 2.0f;
	for (int i = 0; i < segments; i++) {
		float a0 = 2.0f * PI * (float)i / segments;
		float a1 = 2.0f * PI * (float)(i + 1) / segments;
		float u0 = (float)i / segments, u1 = (float)(i + 1) / segments;
		float c0 = cosf(a0), s0 = sinf(a0), c1 = cosf(a1), s1 = sinf(a1);
		// side
		float b0x = rBottom*c0, b0z = rBottom*s0, b1x = rBottom*c1, b1z = rBottom*s1;
		float t0x = rTop*c0,    t0z = rTop*s0,    t1x = rTop*c1,    t1z = rTop*s1;
		pushV(g, b0x,-hy,b0z, u0,0); pushV(g, b1x,-hy,b1z, u1,0); pushV(g, t1x,hy,t1z, u1,1);
		pushV(g, b0x,-hy,b0z, u0,0); pushV(g, t1x,hy,t1z, u1,1); pushV(g, t0x,hy,t0z, u0,1);
		// bottom cap
		if (rBottom > 0.0f) {
			pushV(g, 0,-hy,0, 0.5f,0.5f);
			pushV(g, b1x,-hy,b1z, (c1+1)/2,(s1+1)/2);
			pushV(g, b0x,-hy,b0z, (c0+1)/2,(s0+1)/2);
		}
		// top cap
		if (rTop > 0.0f) {
			pushV(g, 0,hy,0, 0.5f,0.5f);
			pushV(g, t0x,hy,t0z, (c0+1)/2,(s0+1)/2);
			pushV(g, t1x,hy,t1z, (c1+1)/2,(s1+1)/2);
		}
	}
	return g;
}

static Geometry createTetrahedron(float radius) {
	Geometry g;
	float a = radius * sqrtf(8.0f / 9.0f);
	float b = radius * sqrtf(2.0f / 9.0f);
	float c = radius * sqrtf(2.0f / 3.0f);
	float d = radius / 3.0f;
	float vtx[4][3] = { {0, radius, 0}, {-c, -d, -b}, {c, -d, -b}, {0, -d, a} };
	int faces[4][3] = { {0,1,2},{0,2,3},{0,3,1},{1,3,2} };
	for (int f = 0; f < 4; f++) {
		for (int k = 0; k < 3; k++) {
			float* p = vtx[faces[f][k]];
			float u, v; sphericalUV(p[0], p[1], p[2], u, v);
			pushV(g, p[0], p[1], p[2], u, v);
		}
	}
	return g;
}

static Geometry createOctahedron(float radius) {
	Geometry g;
	float vtx[6][3] = {
		{0, radius, 0}, {0, -radius, 0},
		{radius, 0, 0}, {-radius, 0, 0},
		{0, 0, radius}, {0, 0, -radius}
	};
	int faces[8][3] = {
		{0,4,2},{0,2,5},{0,5,3},{0,3,4},
		{1,2,4},{1,5,2},{1,3,5},{1,4,3}
	};
	for (int f = 0; f < 8; f++) {
		for (int k = 0; k < 3; k++) {
			float* p = vtx[faces[f][k]];
			float u, v; sphericalUV(p[0], p[1], p[2], u, v);
			pushV(g, p[0], p[1], p[2], u, v);
		}
	}
	return g;
}

static Geometry createTorus(float majorRadius, float minorRadius, int majorSegments, int minorSegments) {
	Geometry g;
	#define TP(TH, PH, OX, OY, OZ) \
		float OX = (majorRadius + minorRadius * cosf(PH)) * cosf(TH); \
		float OY = minorRadius * sinf(PH); \
		float OZ = (majorRadius + minorRadius * cosf(PH)) * sinf(TH);
	for (int j = 0; j < majorSegments; j++) {
		float u0 = (float)j / majorSegments, u1 = (float)(j + 1) / majorSegments;
		float th0 = u0 * PI * 2.0f, th1 = u1 * PI * 2.0f;
		for (int i = 0; i < minorSegments; i++) {
			float v0 = (float)i / minorSegments, v1 = (float)(i + 1) / minorSegments;
			float ph0 = v0 * PI * 2.0f, ph1 = v1 * PI * 2.0f;
			TP(th0, ph0, p00x, p00y, p00z)
			TP(th1, ph0, p10x, p10y, p10z)
			TP(th0, ph1, p01x, p01y, p01z)
			TP(th1, ph1, p11x, p11y, p11z)
			pushV(g, p00x,p00y,p00z, u0,v0); pushV(g, p10x,p10y,p10z, u1,v0); pushV(g, p11x,p11y,p11z, u1,v1);
			pushV(g, p00x,p00y,p00z, u0,v0); pushV(g, p11x,p11y,p11z, u1,v1); pushV(g, p01x,p01y,p01z, u0,v1);
		}
	}
	#undef TP
	return g;
}

//****************************************************************************/

WGPUInstance instance;
WGPUDevice device;
WGPUQueue queue;
WGPUSurface surface;

WGPUTextureFormat surfaceFormat = WGPUTextureFormat_BGRA8Unorm;
WGPUTextureFormat depthFormat   = WGPUTextureFormat_Depth24Plus;

WGPURenderPipeline pipeline;

WGPUTexture depthTexture = nullptr;
WGPUTextureView depthView = nullptr;
uint32_t depthW = 0, depthH = 0;

struct Mesh {
	WGPUBuffer posBuf;
	WGPUBuffer uvBuf;
	WGPUBuffer uniformBuf;
	WGPUBindGroup bindGroup;
	uint32_t vertexCount;
	float position[3];
	float rotateX;
};
std::vector<Mesh> meshes;

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

WGPUBuffer createVertexBuffer(const std::vector<float>& data) {
	WGPUBufferDescriptor desc = {};
	desc.usage = WGPUBufferUsage_CopyDst | WGPUBufferUsage_Vertex;
	desc.size  = data.size() * sizeof(float);
	WGPUBuffer buffer = wgpuDeviceCreateBuffer(device, &desc);
	wgpuQueueWriteBuffer(queue, buffer, 0, data.data(), desc.size);
	return buffer;
}

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

char const primitive_vert_wgsl[] = R"(
	struct Uniforms {
		modelViewProjectionMatrix : mat4x4<f32>
	};
	@binding(0) @group(0) var<uniform> uniforms : Uniforms;

	struct VertexOutput {
		@builtin(position) Position : vec4<f32>,
		@location(0) vTexCoord : vec2<f32>
	}

	@vertex
	fn main(
		@location(0) position : vec3<f32>,
		@location(1) texCoord : vec2<f32>
	) -> VertexOutput {
		var output : VertexOutput;
		output.vTexCoord = texCoord;
		output.Position = uniforms.modelViewProjectionMatrix * vec4<f32>(position, 1.0);
		return output;
	}
)";

char const primitive_frag_wgsl[] = R"(
	@binding(1) @group(0) var mySampler : sampler;
	@binding(2) @group(0) var myTexture : texture_2d<f32>;

	@fragment
	fn main(
		@location(0) vTexCoord : vec2<f32>
	) -> @location(0) vec4<f32> {
		return textureSample(myTexture, mySampler, vTexCoord);
	}
)";

void createPipelineAndBuffers() {
	WGPUShaderModule vertMod = createShader(primitive_vert_wgsl);
	WGPUShaderModule fragMod = createShader(primitive_frag_wgsl);

	WGPUVertexAttribute posAttr = {};
	posAttr.format = WGPUVertexFormat_Float32x3;
	posAttr.offset = 0;
	posAttr.shaderLocation = 0;

	WGPUVertexAttribute uvAttr = {};
	uvAttr.format = WGPUVertexFormat_Float32x2;
	uvAttr.offset = 0;
	uvAttr.shaderLocation = 1;

	WGPUVertexBufferLayout vertexBufferLayouts[2] = {};
	vertexBufferLayouts[0].arrayStride = 3 * sizeof(float);
	vertexBufferLayouts[0].attributeCount = 1;
	vertexBufferLayouts[0].attributes = &posAttr;
	vertexBufferLayouts[1].arrayStride = 2 * sizeof(float);
	vertexBufferLayouts[1].attributeCount = 1;
	vertexBufferLayouts[1].attributes = &uvAttr;

	WGPUColorTargetState colorTarget = {};
	colorTarget.format = webgpu::getSurfaceFormat();
	colorTarget.writeMask = WGPUColorWriteMask_All;

	WGPUFragmentState fragment = {};
	fragment.module = fragMod;
	fragment.entryPoint = { "main", WGPU_STRLEN };
	fragment.targetCount = 1;
	fragment.targets = &colorTarget;

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
	desc.primitive.cullMode = WGPUCullMode_None; // double-sided
	desc.primitive.topology = WGPUPrimitiveTopology_TriangleList;
	desc.primitive.stripIndexFormat = WGPUIndexFormat_Undefined;

	pipeline = wgpuDeviceCreateRenderPipeline(device, &desc);

	wgpuShaderModuleRelease(fragMod);
	wgpuShaderModuleRelease(vertMod);

	// Shared earth texture + sampler
	WGPUTexture texture = createTextureFromMemory(earth_jpg, earth_jpg_len);
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

	const float s = 2.5f;
	struct PrimDef { Geometry geo; float pos[3]; float rotateX; };
	std::vector<PrimDef> defs;
	defs.push_back({ createPlane(1.5f, 1.5f, 4),            {-s,  s, 0}, 0.0f });
	defs.push_back({ createCube(1.2f),                      { 0,  s, 0}, 0.0f });
	defs.push_back({ createSphere(0.8f, 48),                { s,  s, 0}, 0.0f });
	defs.push_back({ createCircle(0.8f, 32),                {-s,  0, 0}, -PI / 2.0f });
	defs.push_back({ createCylinder(1.2f, 0.6f, 0.6f, 32),  { 0,  0, 0}, 0.0f });
	defs.push_back({ createCylinder(1.2f, 0.7f, 0.0f, 32),  { s,  0, 0}, 0.0f });
	defs.push_back({ createTetrahedron(0.8f),               {-s, -s, 0}, 0.0f });
	defs.push_back({ createOctahedron(0.8f),                { 0, -s, 0}, 0.0f });
	defs.push_back({ createTorus(0.5f, 0.25f, 32, 16),      { s, -s, 0}, 0.0f });

	for (size_t i = 0; i < defs.size(); i++) {
		Mesh m = {};
		m.posBuf = createVertexBuffer(defs[i].geo.positions);
		m.uvBuf  = createVertexBuffer(defs[i].geo.uvs);
		m.vertexCount = (uint32_t)(defs[i].geo.positions.size() / 3);
		m.position[0] = defs[i].pos[0];
		m.position[1] = defs[i].pos[1];
		m.position[2] = defs[i].pos[2];
		m.rotateX = defs[i].rotateX;

		WGPUBufferDescriptor uboDesc = {};
		uboDesc.usage = WGPUBufferUsage_Uniform | WGPUBufferUsage_CopyDst;
		uboDesc.size  = 16 * sizeof(float);
		m.uniformBuf = wgpuDeviceCreateBuffer(device, &uboDesc);

		WGPUBindGroupEntry entries[3] = {};
		entries[0].binding = 0;
		entries[0].buffer  = m.uniformBuf;
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
		m.bindGroup = wgpuDeviceCreateBindGroup(device, &bgDesc);

		meshes.push_back(m);
	}
}

bool redraw() {
	uint32_t winW = (uint32_t)canvas_get_width();
	uint32_t winH = (uint32_t)canvas_get_height();
	if (winW != curW || winH != curH) {
		configureSurface(winW, winH);
	}

	float time = (float)(emscripten_get_now() / 1000.0);
	float aspect = (float)curW / (float)curH;

	float projection[16];
	mat4_perspective(projection, PI / 4.0f, aspect, 0.1f, 100.0f);
	float eye[3] = { 0, 0, 10 }, center[3] = { 0, 0, 0 }, up[3] = { 0, 1, 0 };
	float view[16];
	mat4_lookat(view, eye, center, up);

	WGPUSurfaceTexture surfaceTexture;
	wgpuSurfaceGetCurrentTexture(surface, &surfaceTexture);
	WGPUTextureView backBufView = wgpuTextureCreateView(surfaceTexture.texture, nullptr);

	ensureDepth(wgpuTextureGetWidth(surfaceTexture.texture), wgpuTextureGetHeight(surfaceTexture.texture));

	WGPURenderPassColorAttachment colorDesc = {};
	colorDesc.view       = backBufView;
	colorDesc.depthSlice = WGPU_DEPTH_SLICE_UNDEFINED;
	colorDesc.loadOp     = WGPULoadOp_Clear;
	colorDesc.storeOp    = WGPUStoreOp_Store;
	colorDesc.clearValue = { 0.0f, 0.0f, 0.02f, 1.0f };

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

	for (size_t i = 0; i < meshes.size(); i++) {
		Mesh& m = meshes[i];
		float model[16];
		mat4_identity(model);
		mat4_translate(model, m.position[0], m.position[1], m.position[2]);
		mat4_rotate(model, time * 0.5f, 0.0f, 1.0f, 0.0f);
		if (m.rotateX != 0.0f) {
			mat4_rotate(model, m.rotateX, 1.0f, 0.0f, 0.0f);
		}
		float mv[16], mvp[16];
		mat4_multiply(mv, view, model);
		mat4_multiply(mvp, projection, mv);
		wgpuQueueWriteBuffer(queue, m.uniformBuf, 0, mvp, sizeof(mvp));

		wgpuRenderPassEncoderSetVertexBuffer(pass, 0, m.posBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetVertexBuffer(pass, 1, m.uvBuf, 0, WGPU_WHOLE_SIZE);
		wgpuRenderPassEncoderSetBindGroup(pass, 0, m.bindGroup, 0, nullptr);
		wgpuRenderPassEncoderDraw(pass, m.vertexCount, 1, 0, 0);
	}

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
