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

    const aspect = Math.abs(c.width / c.height);
    let projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 45, aspect, 0.1, 100.0);

    const ctx = c.getContext('gpupresent')
    const swapChainFormat = "bgra8unorm";
    const swapChain = configureSwapChain(device, swapChainFormat, ctx);

    let vShaderModule = makeShaderModule_GLSL(glslang, device, 'vertex', vertexShaderGLSL);
    let fShaderModule = makeShaderModule_GLSL(glslang, device, 'fragment', fragmentShaderGLSL);

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
    let positions = [ 
        // Front face
        -0.5, -0.5,  0.5,   1.0, 0.0, 0.0, 1.0, // v0
         0.5, -0.5,  0.5,   1.0, 0.0, 0.0, 1.0, // v1
         0.5,  0.5,  0.5,   1.0, 0.0, 0.0, 1.0, // v2
        -0.5,  0.5,  0.5,   1.0, 0.0, 0.0, 1.0, // v3
        // Back face
        -0.5, -0.5, -0.5,   1.0, 1.0, 0.0, 1.0, // v4
         0.5, -0.5, -0.5,   1.0, 1.0, 0.0, 1.0, // v5
         0.5,  0.5, -0.5,   1.0, 1.0, 0.0, 1.0, // v6
        -0.5,  0.5, -0.5,   1.0, 1.0, 0.0, 1.0, // v7
        // Top face
         0.5,  0.5,  0.5,   0.0, 1.0, 0.0, 1.0, // v2
        -0.5,  0.5,  0.5,   0.0, 1.0, 0.0, 1.0, // v3
        -0.5,  0.5, -0.5,   0.0, 1.0, 0.0, 1.0, // v7
         0.5,  0.5, -0.5,   0.0, 1.0, 0.0, 1.0, // v6
        // Bottom face
        -0.5, -0.5,  0.5,   1.0, 0.5, 0.5, 1.0, // v0
         0.5, -0.5,  0.5,   1.0, 0.5, 0.5, 1.0, // v1
         0.5, -0.5, -0.5,   1.0, 0.5, 0.5, 1.0, // v5
        -0.5, -0.5, -0.5,   1.0, 0.5, 0.5, 1.0, // v4
         // Right face
         0.5, -0.5,  0.5,   1.0, 0.0, 1.0, 1.0, // v1
         0.5,  0.5,  0.5,   1.0, 0.0, 1.0, 1.0, // v2
         0.5,  0.5, -0.5,   1.0, 0.0, 1.0, 1.0, // v6
         0.5, -0.5, -0.5,   1.0, 0.0, 1.0, 1.0, // v5
         // Left face
        -0.5, -0.5,  0.5,   0.0, 0.0, 1.0, 1.0, // v0
        -0.5,  0.5,  0.5,   0.0, 0.0, 1.0, 1.0, // v3
        -0.5,  0.5, -0.5,   0.0, 0.0, 1.0, 1.0, // v7
        -0.5, -0.5, -0.5,   0.0, 0.0, 1.0, 1.0  // v4
    ];
    let indices = [
         0,  1,  2,    0,  2 , 3,  // Front face
         4,  5,  6,    4,  6 , 7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23   // Left face
    ];
    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));
    let indexBuffer = makeIndexBuffer(device, new Uint32Array(indices));

    const uniformsBindGroupLayout = device.createBindGroupLayout({
        bindings: [{
            binding: 0,
            visibility: 1,
            type: "uniform-buffer"
        }]
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [uniformsBindGroupLayout] });
    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
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
                    arrayStride: (3 + 4) * 4,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: "float3"
                        },
                        {
                            // color
                            shaderLocation: 1,
                            offset:  3 * 4,
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
        primitiveTopology: 'triangle-list',
        rasterizationState: {
            frontFace : "ccw",
            cullMode : 'none'
        },
        depthStencilState: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus-stencil8",
        }
    });

    const uniformBufferSize = 4 * 16; // 4x4 matrix

    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const uniformBindGroup = device.createBindGroup({
        layout: uniformsBindGroupLayout,
        bindings: [{
            binding: 0,
            resource: {
                buffer: uniformBuffer,
            },
        }],
    });
    
    let rad = 0;
    function getTransformationMatrix() {
        rad += Math.PI * 1.0 / 180.0;
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
            depth: 1
        },
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.OUTPUT_ATTACHMENT
    });
    let render =  function () {
        uniformBuffer.setSubData(0, getTransformationMatrix());
        const commandEncoder = device.createCommandEncoder();
        const textureView = swapChain.getCurrentTexture().createView();
        const renderPassDescriptor = {
            colorAttachments: [{
                attachment: textureView,
                loadValue: {r: 0, g: 0, b: 0, a: 0},
            }],
            depthStencilAttachment: {
                attachment: depthTexture.createView(),
                depthLoadValue: 1.0,
                depthStoreOp: "store",
                stencilLoadValue: 0,
                stencilStoreOp: "store",
            }
        };
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setVertexBuffer(0, vertexBuffer);
        passEncoder.setIndexBuffer(indexBuffer);
        passEncoder.setBindGroup(0, uniformBindGroup);
        passEncoder.drawIndexed(indexBuffer.pointNum, 1, 0, 0, 0);
        passEncoder.endPass();
        device.getQueue().submit([commandEncoder.finish()]);
        requestAnimationFrame(render);
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

function makeIndexBuffer(device, data) {
    let bufferDescriptor = {
        size: data.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    };
    let indicesBuffer = device.createBuffer(bufferDescriptor);
    indicesBuffer.setSubData(0, data);
    indicesBuffer.pointNum = data.length
    return indicesBuffer
}
