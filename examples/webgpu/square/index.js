const ready = glslang();
ready.then(init);
const vertexShaderGLSL = document.getElementById("vs").textContent;
const fragmentShaderGLSL = document.getElementById("fs").textContent;

async function init(glslang) {
    const gpu = navigator['gpu']; //
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const c = document.getElementById('c');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext('gpupresent')

    const swapChainFormat = "bgra8unorm";
    const swapChain = configureSwapChain(device, swapChainFormat, ctx);

    let vShaderModule = makeShaderModule_GLSL(glslang, device, 'vertex', vertexShaderGLSL);
    let fShaderModule = makeShaderModule_GLSL(glslang, device, 'fragment', fragmentShaderGLSL);

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
        layout: device.createPipelineLayout({bindGroupLayouts: []}),
        vertexStage: {
            module: vShaderModule,
            entryPoint: 'main'
        },
        fragmentStage: {
            module: fShaderModule,
            entryPoint: 'main'
        },
        vertexState: {
            indexFormat: 'uint32',
            vertexBuffers: [
                {
                    arrayStride: 3 * 4,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: "float3"
                        },
                    ]
                },
                {
                    arrayStride: 4 * 4,
                    attributes: [
                        {
                            // color
                            shaderLocation: 1,
                            offset:  0,
                            format: "float4"
                        }
                    ]
                }
            ]
        },
        colorStates: [
            {
                format: swapChainFormat,
                alphaBlend: {
                    srcFactor: "src-alpha",
                    dstFactor: "one-minus-src-alpha",
                    operation: "add"
                }
            }
        ],
        primitiveTopology: 'triangle-strip',
        frontFace : "ccw",
        cullMode : 'none'
    });

    let render =  function () {
        const commandEncoder = device.createCommandEncoder();
        const textureView = swapChain.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                attachment: textureView,
                loadValue: {r: 1, g: 1, b: 0.0, a: 0.0},
            }]
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.endPass();
        const test = commandEncoder.finish()
        device.getQueue().submit([test]);
    }
    requestAnimationFrame(render)

}

function configureSwapChain(device, swapChainFormat, context) {
    const swapChainDescriptor = {
        device: device,
        format: swapChainFormat
    };
    return context.configureSwapChain(swapChainDescriptor);
}

function makeShaderModule_GLSL(glslang, device, type, source) {
    let shaderModuleDescriptor = {
        code: glslang.compileGLSL(source, type),
        source: source
    };
    let shaderModule = device.createShaderModule(shaderModuleDescriptor);
    return shaderModule;
}

function makeVertexBuffer(device, data) {
    let bufferDescriptor = {
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    };
    let verticesBuffer = device.createBuffer(bufferDescriptor);
    verticesBuffer.setSubData(0, data);
    return verticesBuffer
}
