import { draw, effect, frameLoop, geometry, init, sampler, surface, target } from "vgpu";
import { group, perspectiveCamera } from "vgpu/scene";

// Pass 1: renders the teapot into an offscreen target that owns the depth buffer.
const teapotShader = `
struct Camera {
    viewProjection : mat4x4<f32>,
};
struct Model {
    model : mat4x4<f32>,
};
struct Light {
    direction : vec3<f32>,
};
@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<uniform> model : Model;
@group(0) @binding(2) var<uniform> light : Light;
@group(0) @binding(3) var diffuse : texture_2d<f32>;
@group(0) @binding(4) var diffuseSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) normal : vec3<f32>,
    @location(1) uv : vec2<f32>,
};

@vertex
fn vs_main(
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>
) -> VertexOutput {
    var output : VertexOutput;
    output.position = camera.viewProjection * model.model * vec4<f32>(position, 1.0);
    output.normal = (model.model * vec4<f32>(normal, 0.0)).xyz;
    output.uv = uv;
    return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
    let n = normalize(input.normal);
    let diffuseLight = max(dot(n, normalize(-light.direction)), 0.0);
    let color = textureSample(diffuse, diffuseSampler, input.uv).rgb;
    return vec4<f32>(color * (0.2 + 0.8 * diffuseLight), 1.0);
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
        near: 0.1,
        far: 1000,
        position: [0, 0, 50],
        target: [0, 0, 0]
    });

    const spin = group();

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
    const response = await fetch("../../../assets/json/teapot.json");
    const data = await response.json();

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
    const diffuse = await createTextureFromImage(gpu, "../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg");

    const teapot = draw(gpu, {
        shader: teapotShader,
        geometry: geometry(gpu, {
            buffers: [
                {
                    attributes: { position: "float32x3" },
                    data: new Float32Array(data.vertexPositions)
                },
                {
                    attributes: { normal: "float32x3" },
                    data: new Float32Array(data.vertexNormals)
                },
                {
                    attributes: { uv: "float32x2" },
                    data: new Float32Array(data.vertexTextureCoords)
                }
            ],
            indices: new Uint32Array(data.indices)
        })
    });
    teapot.set({
        light: { direction: [-1.0, 0.0, -1.0] },
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
        rad -= Math.PI / 180;
        spin.set({ rotation: [0, rad, 0] });
        teapot.set({
            camera: { viewProjection: camera.viewProjection },
            model: { model: spin.worldMatrix }
        });

        frame.pass({ target: scene, clear: [0.0, 0.0, 0.0, 1.0], clearDepth: 1 }, (pass) => {
            pass.draw(teapot);
        });
        frame.pass(canvasSurface, present);
    });
}

main().catch((error) => {
    console.error(error);
});
