let g_glslang = null;
let g_twgsl = null;

glslang().then(initGlslang);
const vertexShaderGLSL = document.getElementById("vs").textContent;
const fragmentShaderGLSL = document.getElementById("fs").textContent;

async function initGlslang(glslang) {
    g_glslang = glslang;
    twgsl("../../../libs/twgsl.wasm").then(initTwgsl);
}

async function initTwgsl(twgsl) {
    g_twgsl = twgsl;
    
    const gpu = navigator["gpu"];
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const c = document.getElementById("c");
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    const ctx = c.getContext("webgpu");
    const format = ctx.getPreferredFormat(adapter);
    ctx.configure({
        device: device,
        format: format
    });

    let vShaderModule = makeShaderModule_GLSL(g_glslang, g_twgsl, device, "vertex", vertexShaderGLSL);
    let fShaderModule = makeShaderModule_GLSL(g_glslang, g_twgsl, device, "fragment", fragmentShaderGLSL);

    let positions = [ 
         0.0, 0.5, 0.0, // v0
        -0.5,-0.5, 0.0, // v1
         0.5,-0.5, 0.0  // v2
    ];
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));

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

    let render =  function () {
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
        passEncoder.draw(3, 1, 0, 0);
        passEncoder.endPass();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function makeShaderModule_GLSL(glslang, twgsl, device, type, source) {
    let code =  glslang.compileGLSL(source, type);
    code = twgsl.convertSpirV2WGSL(code);

    let shaderModuleDescriptor = {
        code: code,
        source: source
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
