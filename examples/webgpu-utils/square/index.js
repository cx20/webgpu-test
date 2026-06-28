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

    // Square data
    //             1.0 y
    //              ^  -1.0
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    //
    //        [0]------[1]
    //         |        |
    //         |        |
    //         |        |
    //        [2]------[3]
    //
    const positions = [
        -0.5, 0.5, 0.0, // v0
         0.5, 0.5, 0.0, // v1
        -0.5,-0.5, 0.0, // v2
         0.5,-0.5, 0.0  // v3
    ];
    const colors = [
        1.0, 0.0, 0.0, 1.0, // v0
        0.0, 1.0, 0.0, 1.0, // v1
        0.0, 0.0, 1.0, 1.0, // v2
        1.0, 1.0, 0.0, 1.0  // v3
    ];

    // Build interleaved vertex buffer + layout with webgpu-utils
    const vertices = createBuffersAndAttributesFromArrays(device, {
        position: { data: positions, numComponents: 3 },
        color:    { data: colors,    numComponents: 4 },
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
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
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
