// forked from https://github.com/greggman/webgpu-utils/blob/main/examples/cube.js
import { mat4 } from "wgpu-matrix";
import {
    makeShaderDataDefinitions,
    makeStructuredView,
    createBuffersAndAttributesFromArrays,
    createTextureFromImage,
} from "webgpu-utils";

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const canvas = document.querySelector("canvas");
    const context = canvas.getContext("webgpu");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const presentationFormat = gpu.getPreferredCanvasFormat(adapter);
    context.configure({
        device,
        format: presentationFormat,
    });

    const shaderSrc = document.getElementById("shader").textContent;

    // Cube data
    //             1.0 y
    //              ^  -1.0
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    //
    //         [7]------[6]
    //        / |      / |
    //      [3]------[2] |
    //       |  |     |  |
    //       | [4]----|-[5]
    //       |/       |/
    //      [0]------[1]
    //
    const positions = [
        // Front face
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5,  0.5,
        // Back face
        -0.5, -0.5, -0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5, -0.5,
        // Top face
         0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,
        // Bottom face
        -0.5, -0.5,  0.5,  0.5, -0.5,  0.5,  0.5, -0.5, -0.5, -0.5, -0.5, -0.5,
        // Right face
         0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5,
        // Left face
        -0.5, -0.5,  0.5, -0.5,  0.5,  0.5, -0.5,  0.5, -0.5, -0.5, -0.5, -0.5,
    ];
    const texcoords = [
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, // Front
        1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, // Back
        0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, // Top
        1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, // Bottom
        1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, // Right
        0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, // Left
    ];
    const indices = [
         0,  1,  2,    0,  2,  3,  // Front face
         4,  5,  6,    4,  6,  7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23,  // Left face
    ];

    // Build interleaved vertex/index buffers with webgpu-utils
    const vertices = createBuffersAndAttributesFromArrays(device, {
        position: positions,
        texcoord: texcoords,
        indices,
    });

    const shaderModule = device.createShaderModule({ code: shaderSrc });

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: vertices.bufferLayouts,
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{ format: presentationFormat }],
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "none",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
    });

    // Uniforms managed through webgpu-utils' structured views
    const defs = makeShaderDataDefinitions(shaderSrc);
    const vsUniformValues = makeStructuredView(defs.uniforms.vsUniforms);
    const vsUniformBuffer = device.createBuffer({
        size: vsUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const texture = await createTextureFromImage(
        device,
        "../../../assets/textures/frog.jpg",
        { mips: true }
    );
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: vsUniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: texture.createView() },
        ],
    });

    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        depthTexture.destroy();
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    });

    function render(time) {
        time *= 0.001;

        const projection = mat4.perspective(
            45 * Math.PI / 180,
            canvas.clientWidth / canvas.clientHeight,
            0.1,
            100
        );
        const view = mat4.translation([0, 0, -3]);
        const world = mat4.axisRotation([1, 1, 1], time);
        const worldViewProjection = mat4.multiply(projection, mat4.multiply(view, world));

        vsUniformValues.set({ worldViewProjection });
        device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues.arrayBuffer);

        const renderPassDescriptor = {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: [1.0, 1.0, 1.0, 1.0],
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, vertices.buffers[0]);
        passEncoder.setIndexBuffer(vertices.indexBuffer, vertices.indexFormat);
        passEncoder.drawIndexed(vertices.numElements);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
