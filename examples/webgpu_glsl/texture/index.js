let libGlslang = null;
let libTwgsl = null;

const vertexShaderGLSL = document.getElementById("vs").textContent;
const fragmentShaderGLSL = document.getElementById("fs").textContent;

glslang().then(initGlslang);

async function initGlslang(glslang) {
    libGlslang = glslang;
    twgsl("../../../libs/twgsl.wasm").then(initTwgsl);
}

async function initTwgsl(twgsl) {
    libTwgsl = twgsl;
    init();
}

async function init() {
    const gpu = navigator["gpu"];
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const c = document.getElementById("c");
    c.width = window.innerWidth;
    c.height = window.innerHeight;

    const aspect = Math.abs(c.width / c.height);
    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45, aspect, 0.1, 100.0);

    const ctx = c.getContext("webgpu");
    const format = gpu.getPreferredCanvasFormat();
    ctx.configure({
        device: device,
        format: format
    });

    let vShaderModule = makeShaderModule_GLSL(libGlslang, libTwgsl, device, "vertex", vertexShaderGLSL);
    let fShaderModule = makeShaderModule_GLSL(libGlslang, libTwgsl, device, "fragment", fragmentShaderGLSL);

    // Cube data
    //             1.0 y 
    //              ^  -1.0 
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    // 
    //         [7]------[6]
    //        / |      / |
    //      [3]------[2] |
    //       |  |     |  |
    //       | [4]----|-[5]
    //       |/       |/
    //      [0]------[1]
    //
    const positions = [ 
        // Front face
        -0.5, -0.5,  0.5, // v0
         0.5, -0.5,  0.5, // v1
         0.5,  0.5,  0.5, // v2
        -0.5,  0.5,  0.5, // v3
        // Back face
        -0.5, -0.5, -0.5, // v4
         0.5, -0.5, -0.5, // v5
         0.5,  0.5, -0.5, // v6
        -0.5,  0.5, -0.5, // v7
        // Top face
         0.5,  0.5,  0.5, // v2
        -0.5,  0.5,  0.5, // v3
        -0.5,  0.5, -0.5, // v7
         0.5,  0.5, -0.5, // v6
        // Bottom face
        -0.5, -0.5,  0.5, // v0
         0.5, -0.5,  0.5, // v1
         0.5, -0.5, -0.5, // v5
        -0.5, -0.5, -0.5, // v4
         // Right face
         0.5, -0.5,  0.5, // v1
         0.5,  0.5,  0.5, // v2
         0.5,  0.5, -0.5, // v6
         0.5, -0.5, -0.5, // v5
         // Left face
        -0.5, -0.5,  0.5, // v0
        -0.5,  0.5,  0.5, // v3
        -0.5,  0.5, -0.5, // v7
        -0.5, -0.5, -0.5  // v4
    ];
    const textureCoords = [
        // Front face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,

        // Back face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Top face
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,

        // Bottom face
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,

        // Right face
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
        0.0, 0.0,

        // Left face
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0,
    ];
    const indices = [
         0,  1,  2,    0,  2 , 3,  // Front face
         4,  5,  6,    4,  6 , 7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23   // Left face
    ];
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));
    let coordBuffer = makeVertexBuffer(device, new Float32Array(textureCoords));
    let indexBuffer = makeIndexBuffer(device, new Uint32Array(indices));

    const uniformsBindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
                type: 'uniform',
            },
        }, {
           // Sampler
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: {
                type: 'filtering',
            },
        }, {
            // Texture view
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: {
                sampleType: 'float',
            },
        }]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [uniformsBindGroupLayout] });
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
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
                    arrayStride: 2 * 4,
                    attributes: [
                        {
                            // textureCoord
                            shaderLocation: 1,
                            offset:  0,
                            format: "float32x2"
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
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus-stencil8"
        }
    });

    const uniformBufferSize = 4 * 16; // 4x4 matrix

    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const cubeTexture = await createTextureFromImage(device, "../../../assets/textures/frog.jpg", GPUTextureUsage.TEXTURE_BINDING);
    
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });

    const uniformBindGroup = device.createBindGroup({
        layout: uniformsBindGroupLayout,
        entries: [{
            binding: 0,
            resource: {
                buffer: uniformBuffer,
            }, 
        }, {
            binding: 1,
            resource: sampler,
        }, {
            binding: 2,
            resource: cubeTexture.createView(),
        }],
    });
    
    let rad = 0;
    function getTransformationMatrix(timestamp) {
        //rad += Math.PI * 1.0 / 180.0;
        rad = timestamp / 1000; // Seconds since the first requestAnimationFrame (ms)
        let viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -3));
        let now = Date.now() / 1000;
        //mat4.rotate(viewMatrix, viewMatrix, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0));
        mat4.rotate(viewMatrix, viewMatrix, rad, [1, 1, 1]);

        let modelViewProjectionMatrix = mat4.create();
        mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

        return modelViewProjectionMatrix;
    }

    const depthTexture = device.createTexture({
        size: {
            width: c.width,
            height: c.height,
            depthOrArrayLayers: 1
        },
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    let render =  function (timestamp) {
        const commandEncoder = device.createCommandEncoder();
        const { uploadBuffer } = updateBufferData(device, uniformBuffer, 0, getTransformationMatrix(timestamp), commandEncoder);
        const textureView = ctx.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                clearValue: {r: 1, g: 1, b: 1, a: 1},
                storeOp: "store"
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: "store",
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: "store"
            }
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setVertexBuffer(1, coordBuffer);
        passEncoder.setIndexBuffer(indexBuffer, "uint32");
        passEncoder.setBindGroup(0, uniformBindGroup);
        passEncoder.drawIndexed(indexBuffer.pointNum, 1, 0, 0, 0);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        uploadBuffer.destroy();
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
        mappedAtCreation: true
    });
    new Float32Array(verticesBuffer.getMappedRange()).set(data);
    verticesBuffer.unmap();
    return verticesBuffer;
}

function makeIndexBuffer(device, data) {
    const indicesBuffer = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true
    });
    new Uint32Array(indicesBuffer.getMappedRange()).set(data);
    indicesBuffer.pointNum = data.length;
    indicesBuffer.unmap();
    return indicesBuffer;
}

function updateBufferData(device, dst, dstOffset, src, commandEncoder) {
    const uploadBuffer = device.createBuffer({
        size: src.byteLength,
        usage: GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true
    });

    new src.constructor(uploadBuffer.getMappedRange()).set(src);
    uploadBuffer.unmap();

    commandEncoder = commandEncoder || device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(uploadBuffer, 0, dst, dstOffset, src.byteLength);

    return { commandEncoder, uploadBuffer };
}

async function createTextureFromImage(device, src, usage) {
    const img = document.createElement("img");
    img.src = src;
    await img.decode();
    const imageBitmap = await createImageBitmap(img);

    cubeTexture = device.createTexture({
      size: [imageBitmap.width, imageBitmap.height, 1],
      format: 'rgba8unorm',
      usage: usage | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: cubeTexture },
      [imageBitmap.width, imageBitmap.height, 1]
    );
    return cubeTexture;
}
