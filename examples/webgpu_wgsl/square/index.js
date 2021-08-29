init();
const vertexShaderWGSL = document.getElementById("vs").textContent;
const fragmentShaderWGSL = document.getElementById("fs").textContent;

async function init() {
    const gpu = navigator["gpu"];
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const c = document.getElementById("c");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext("webgpu");

    const format = ctx.getPreferredFormat(adapter);
    const swapChain = configureSwapChain(device, format, ctx);

    let vShaderModule = makeShaderModule_WGSL(device, vertexShaderWGSL);
    let fShaderModule = makeShaderModule_WGSL(device, fragmentShaderWGSL);

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
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));
    let colorBuffer = makeVertexBuffer(device, new Float32Array(colors));

    const pipeline = device.createRenderPipeline({
        vertex: {
            module: vShaderModule,
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 3 * 4,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: "float32x3"
                        }
                    ]
                },
                {
                    arrayStride: 4 * 4,
                    attributes: [
                        {
                            // color
                            shaderLocation: 1,
                            offset:  0,
                            format: "float32x4"
                        }
                    ]
                }
            ]
        },
        fragment: {
            module: fShaderModule,
            entryPoint: "main",
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: "triangle-strip",
            stripIndexFormat: "uint32"
        },
    });

    let render = function () {
        const commandEncoder = device.createCommandEncoder();
        const textureView = ctx.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadValue: {r: 1, g: 1, b: 1, a: 1},
                storeOp: "store"
            }]
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.endPass();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function configureSwapChain(device, format, context) {
    const swapChainDescriptor = {
        device: device,
        format: format
    };
    return context.configure(swapChainDescriptor);
}

function makeShaderModule_WGSL(device, source) {
    let shaderModuleDescriptor = {
        code: source
    };
    let shaderModule = device.createShaderModule(shaderModuleDescriptor);
    return shaderModule;
}

function makeVertexBuffer(device, data) {
    const verticesBuffer = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(data);
    verticesBuffer.unmap();
    return verticesBuffer;
}
