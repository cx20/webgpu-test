let libGlslang = null;
let libTwgsl = null;

const vertexShaderGLSL = document.getElementById("vs").textContent;
const fragmentShaderGLSL = document.getElementById("fs").textContent;

let promise1 = glslang();
let promise2 = twgsl("../../../libs/twgsl.wasm");

Promise.all([promise1, promise2]).then((args) => {
    libGlslang = args[0];
    libTwgsl = args[1];
    init();
});

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
        format: format
    });

    let vShaderModule = makeShaderModule_GLSL(libGlslang, libTwgsl, device, "vertex", vertexShaderGLSL);
    let fShaderModule = makeShaderModule_GLSL(libGlslang, libTwgsl, device, "fragment", fragmentShaderGLSL);

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

    let render =  function () {
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
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.setPipeline(pipeline);
        passEncoder.draw(4, 1, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

}

function makeShaderModule_GLSL(glslang, twgsl, device, type, source) {
    let code =  glslang.compileGLSL(source, type);
    code = twgsl.convertSpirV2WGSL(code);
    console.log("// SPIR-V to WGSL");
    console.log(code);

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
