const vertexShaderWGSL = document.getElementById("vs").textContent;
const fragmentShaderWGSL = document.getElementById("fs").textContent;
init();

async function init() {
    const gpu = navigator["gpu"];
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const c = document.getElementById("c");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext("webgpu");
    const format = gpu.getPreferredCanvasFormat();
    ctx.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    let vShaderModule = makeShaderModule_WGSL(device, vertexShaderWGSL);
    let fShaderModule = makeShaderModule_WGSL(device, fragmentShaderWGSL);

    let positions = [ 
         0.0, 0.5, 0.0, // v0
        -0.5,-0.5, 0.0, // v1
         0.5,-0.5, 0.0  // v2
    ];
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));

    const pipeline = device.createRenderPipeline({
        layout: "auto",
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
            topology: "triangle-list"
        }
    });

    let render = function () {
        const commandEncoder = device.createCommandEncoder();
        const textureView = ctx.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                clearValue: {r: 1, g: 1, b: 1, a: 1},
                storeOp: "store"
            }]
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
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
