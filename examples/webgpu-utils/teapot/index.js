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

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
    const teapot = await (await fetch("../../../assets/json/teapot.json")).json();

    const vertices = createBuffersAndAttributesFromArrays(device, {
        position: teapot.vertexPositions,
        normal: teapot.vertexNormals,
        texcoord: teapot.vertexTextureCoords,
        indices: teapot.indices,
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
    const fsUniformValues = makeStructuredView(defs.uniforms.fsUniforms);

    const vsUniformBuffer = device.createBuffer({
        size: vsUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const fsUniformBuffer = device.createBuffer({
        size: fsUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Point light position is constant
    fsUniformValues.set({ lightPosition: [100.0, 0.0, 100.0] });
    device.queue.writeBuffer(fsUniformBuffer, 0, fsUniformValues.arrayBuffer);

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
    const texture = await createTextureFromImage(
        device,
        "../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg",
        { mips: true }
    );
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat",
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: vsUniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: texture.createView() },
            { binding: 3, resource: { buffer: fsUniformBuffer } },
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
            1000
        );
        const view = mat4.translation([0, 0, -35]);
        const world = mat4.rotationY(time);
        const worldViewProjection = mat4.multiply(projection, mat4.multiply(view, world));

        vsUniformValues.set({ worldViewProjection, world });
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
