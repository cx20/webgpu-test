// forked from https://github.com/greggman/webgpu-utils/blob/main/examples/cube.js
import { createBuffersAndAttributesFromArrays } from "webgpu-utils";

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

    const vertexShaderWGSL   = document.getElementById("vs").textContent;
    const fragmentShaderWGSL = document.getElementById("fs").textContent;

    const positions = [
         0.0,  0.5, 0.0, // v0
        -0.5, -0.5, 0.0, // v1
         0.5, -0.5, 0.0  // v2
    ];

    // Build the vertex buffer + layout with webgpu-utils
    const vertices = createBuffersAndAttributesFromArrays(device, {
        position: positions,
    });

    async function createShaderModule(device, code) {
        device.pushErrorScope("validation");
        const shader = device.createShaderModule({
            code
        });
        const error = await device.popErrorScope();
        if (error) {
            throw new Error(error.message);
        }
        return shader;
    }

    const vertexShaderModule   = await createShaderModule(device, vertexShaderWGSL);
    const fragmentShaderModule = await createShaderModule(device, fragmentShaderWGSL);

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: vertexShaderModule,
            entryPoint: "main",
            buffers: vertices.bufferLayouts,
        },
        fragment: {
            module: fragmentShaderModule,
            entryPoint: "main",
            targets: [
                {
                    format: presentationFormat
                }
            ]
        },
        primitive: {
            topology: "triangle-list"
        }
    });

    function render(time) {
        const textureView = context.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                clearValue: {r: 1, g: 1, b: 1, a: 1},
                storeOp: "store"
            }]
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertices.buffers[0]);
        passEncoder.draw(vertices.numElements);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
