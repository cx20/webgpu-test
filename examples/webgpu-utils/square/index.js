// forked from https://github.com/greggman/webgpu-utils/blob/main/examples/cube.js
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

    const canvasInfo = {
        canvas,
        context,
        presentationFormat,
    };

    const vertexShaderWGSL   = document.getElementById("vs").textContent;
    const fragmentShaderWGSL = document.getElementById("fs").textContent;

    function createBuffer(device, data, usage) {
        const buffer = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

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
    let positions = [ 
        -0.5, 0.5, 0.0, // v0
         0.5, 0.5, 0.0, // v1
        -0.5,-0.5, 0.0, // v2
         0.5,-0.5, 0.0  // v3
    ];
    let colors = [ 
        1.0, 0.0, 0.0, 1.0, // v0
        0.0, 1.0, 0.0, 1.0, // v1
        0.0, 0.0, 1.0, 1.0, // v2
        1.0, 1.0, 0.0, 1.0  // v3
    ];
  
    const vertexBuffer = createBuffer(device, new Float32Array(positions), GPUBufferUsage.VERTEX);
    const colorBuffer  = createBuffer(device, new Float32Array(colors),    GPUBufferUsage.VERTEX);
  
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
            buffers: [
                // position
                {
                    arrayStride: 3 * 4, // 3 floats, 4 bytes each
                    attributes: [
                        {
                            shaderLocation: 0,
                            offset: 0,
                           format: "float32x3"
                        }
                    ]
                },
                // color
                {
                    arrayStride: 4 * 4, // 4 floats, 4 bytes each
                    attributes: [
                        {
                            shaderLocation: 1,
                            offset: 0,
                            format: "float32x4"
                        }
                    ]
                }
            ]
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
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();