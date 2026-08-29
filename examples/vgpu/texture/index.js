import { draw, effect, frameLoop, geometry, init, sampler, surface, target } from "vgpu";
import { group, perspectiveCamera } from "vgpu/scene";

// Pass 1: renders the textured cube into an offscreen target that owns the depth buffer.
const cubeShader = `
struct Camera {
    viewProjection : mat4x4<f32>,
};
struct Model {
    model : mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<uniform> model : Model;
@group(0) @binding(2) var diffuse : texture_2d<f32>;
@group(0) @binding(3) var diffuseSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) uv : vec2<f32>,
};

@vertex
fn vs_main(@location(0) position : vec3<f32>, @location(1) uv : vec2<f32>) -> VertexOutput {
    var output : VertexOutput;
    output.position = camera.viewProjection * model.model * vec4<f32>(position, 1.0);
    output.uv = uv;
    return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(diffuse, diffuseSampler, input.uv);
}
`;

// Pass 2: copies the offscreen color texture onto the canvas.
const presentShader = `
@group(0) @binding(0) var scene : texture_2d<f32>;
@group(0) @binding(1) var sceneSampler : sampler;

@fragment
fn fs_main(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    return textureSampleLevel(scene, sceneSampler, uv, 0.0);
}
`;

const positions = new Float32Array([
    // Front face
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    // Back face
     0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
    // Top face
    -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
    // Bottom face
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
    // Right face
     0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
    // Left face
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5
]);

const uvs = new Float32Array([
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0,  // Front
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0,  // Back
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0,  // Top
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0,  // Bottom
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0,  // Right
    0.0, 1.0,  1.0, 1.0,  1.0, 0.0,  0.0, 0.0   // Left
]);

const indices = new Uint32Array([
     0,  1,  2,   0,  2,  3,  // Front
     4,  5,  6,   4,  6,  7,  // Back
     8,  9, 10,   8, 10, 11,  // Top
    12, 13, 14,  12, 14, 15,  // Bottom
    16, 17, 18,  16, 18, 19,  // Right
    20, 21, 22,  20, 22, 23   // Left
]);

// Decodes an image and uploads it into a texture vgpu can bind by name.
async function createTextureFromImage(gpu, url) {
    const response = await fetch(url);
    const bitmap = await createImageBitmap(await response.blob());

    const texture = gpu.device.createTexture({
        size: [bitmap.width, bitmap.height],
        format: "rgba8unorm",
        usage: ["texture_binding", "copy_dst", "render_attachment"]
    });
    gpu.gpu.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: texture.gpu },
        [bitmap.width, bitmap.height]
    );
    return texture;
}

async function main() {
    const canvas = document.querySelector("#c");

    const gpu = await init();
    const canvasSurface = surface(gpu, canvas);

    // A surface has no depth buffer, so vgpu renders the scene into an offscreen
    // target that has one and composites it onto the canvas as a full-screen effect.
    const scene = target(gpu, { size: canvasSurface.size, depth: true });

    const camera = perspectiveCamera({
        fov: 45,
        aspect: scene.size[0] / scene.size[1],
        position: [0, 0, 3],
        target: [0, 0, 0]
    });

    const spin = group();

    const diffuse = await createTextureFromImage(gpu, "../../../assets/textures/frog.jpg");

    const cube = draw(gpu, {
        shader: cubeShader,
        geometry: geometry(gpu, {
            buffers: [
                {
                    attributes: { position: "float32x3" },
                    data: positions
                },
                {
                    attributes: { uv: "float32x2" },
                    data: uvs
                }
            ],
            indices
        }),
        cull: "back"
    });
    cube.set({
        diffuse,
        diffuseSampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" })
    });

    const present = effect(gpu, presentShader, {
        set: {
            scene,
            sceneSampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" })
        }
    });

    canvasSurface.onResize(({ width, height }) => {
        scene.resize([width, height]);
        camera.set({ aspect: width / height });
        present.set({ scene });
    });

    let rad = 0.0;
    frameLoop(gpu, (frame) => {
        rad += Math.PI / 180;
        spin.set({ rotation: [rad, rad, rad] });
        cube.set({
            camera: { viewProjection: camera.viewProjection },
            model: { model: spin.worldMatrix }
        });

        frame.pass({ target: scene, clear: [1.0, 1.0, 1.0, 1.0], clearDepth: 1 }, (pass) => {
            pass.draw(cube);
        });
        frame.pass(canvasSurface, present);
    });
}

main().catch((error) => {
    console.error(error);
});
