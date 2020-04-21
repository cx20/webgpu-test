const ready = glslang();
ready.then(init);
const vertexShaderGLSL = document.getElementById("vs").textContent;
const fragmentShaderGLSL = document.getElementById("fs").textContent;

async function init(glslang) {
    const gpu = navigator['gpu'];
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

    let positions = [ 
         0.0, 0.5, 0.0, // v0
        -0.5,-0.5, 0.0, // v1
         0.5,-0.5, 0.0  // v2
    ];
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));

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
        primitiveTopology: 'triangle-list',
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
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.endPass();
        const test = commandEncoder.finish()
        device.defaultQueue.submit([test]);
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
    const [verticesBuffer, vertexMapping] = device.createBufferMapped({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX
    });
    new Float32Array(vertexMapping).set(data);
    verticesBuffer.unmap();
    return verticesBuffer;
}
