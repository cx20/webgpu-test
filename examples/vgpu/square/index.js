import { draw, effect, frameLoop, geometry, init, sampler, surface, target } from "vgpu";

// Pass 1: renders the square into an offscreen target.
const squareShader = `
struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) color : vec4<f32>,
};

@vertex
fn vs_main(@location(0) position : vec3<f32>, @location(1) color : vec4<f32>) -> VertexOutput {
    var output : VertexOutput;
    output.position = vec4<f32>(position, 1.0);
    output.color = color;
    return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
    return input.color;
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
    -0.5,  0.5, 0.0, // v0
     0.5,  0.5, 0.0, // v1
    -0.5, -0.5, 0.0, // v2
     0.5, -0.5, 0.0  // v3
]);

const colors = new Float32Array([
    1.0, 0.0, 0.0, 1.0, // v0
    0.0, 1.0, 0.0, 1.0, // v1
    0.0, 0.0, 1.0, 1.0, // v2
    1.0, 1.0, 0.0, 1.0  // v3
]);

const indices = new Uint32Array([
    0, 2, 1,
    1, 2, 3
]);

async function main() {
    const canvas = document.querySelector("#c");

    const gpu = await init();
    const canvasSurface = surface(gpu, canvas);

    // A surface has no depth buffer, so vgpu renders the scene into an offscreen
    // target that has one and composites it onto the canvas as a full-screen effect.
    const scene = target(gpu, { size: canvasSurface.size, depth: true });

    // One vertex buffer stream per attribute; names are matched against the vertex stage.
    const square = draw(gpu, {
        shader: squareShader,
        geometry: geometry(gpu, {
            buffers: [
                {
                    attributes: { position: "float32x3" },
                    data: positions
                },
                {
                    attributes: { color: "float32x4" },
                    data: colors
                }
            ],
            indices
        })
    });

    const present = effect(gpu, presentShader, {
        set: {
            scene,
            sceneSampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" })
        }
    });

    canvasSurface.onResize(({ width, height }) => {
        scene.resize([width, height]);
        present.set({ scene });
    });

    frameLoop(gpu, (frame) => {
        frame.pass({ target: scene, clear: [1.0, 1.0, 1.0, 1.0], clearDepth: 1 }, (pass) => {
            pass.draw(square);
        });
        frame.pass(canvasSurface, present);
    });
}

main().catch((error) => {
    console.error(error);
});
