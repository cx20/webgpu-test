(async()=>{
const canvas = document.querySelector('#c');
canvas.width = innerWidth;
canvas.height = innerHeight;
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const glslang = await glslangModule();

const stage = new Hilo3d.Node();
const camera = new Hilo3d.PerspectiveCamera({
    aspect: innerWidth / innerHeight,
    far: 100,
    near: 0.1,
    z: 3
});

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
const colors = [
    [1.0, 0.0, 0.0, 1.0], // Front face
    [1.0, 1.0, 0.0, 1.0], // Back face
    [0.0, 1.0, 0.0, 1.0], // Top face
    [1.0, 0.5, 0.5, 1.0], // Bottom face
    [1.0, 0.0, 1.0, 1.0], // Right face
    [0.0, 0.0, 1.0, 1.0]  // Left face
];
let unpackedColors = [];
for (let i in colors) {
    let color = colors[i];
    for (let j=0; j < 4; j++) {
        unpackedColors = unpackedColors.concat(color);
    }
}
const indices = [
     0,  1,  2,    0,  2 , 3,  // Front face
     4,  5,  6,    4,  6 , 7,  // Back face
     8,  9, 10,    8, 10, 11,  // Top face
    12, 13, 14,   12, 14, 15,  // Bottom face
    16, 17, 18,   16, 18, 19,  // Right face
    20, 21, 22,   20, 22, 23   // Left face
];

const geometry = new Hilo3d.Geometry({
    vertices: new Hilo3d.GeometryData(new Float32Array(positions), 3),
    colors: new Hilo3d.GeometryData(new Float32Array(unpackedColors), 4),
    indices: new Hilo3d.GeometryData(new Uint16Array(indices), 1)
});

const mesh = new Hilo3d.Mesh({
    geometry: geometry,
    material: new Hilo3d.BasicMaterial({
    }),
    onUpdate: function() {
        this.rotationX += .5;
        this.rotationY += .5;
    }
});

stage.addChild(camera);
stage.addChild(mesh);

const vs = document.getElementById("vs").textContent;
const fs = document.getElementById("fs").textContent;

const context = canvas.getContext('webgpu');

const swapChainFormat = "bgra8unorm";

const swapChain = context.configure({
    device,
    format: swapChainFormat,
});

const verticesData = geometry.vertices.data;
const verticesBuffer = device.createBuffer({
    size: verticesData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
});
new Float32Array(verticesBuffer.getMappedRange()).set(verticesData);
verticesBuffer.unmap();

const colorsData = geometry.colors.data;
const colorsBuffer = device.createBuffer({
    size: colorsData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
});
new Float32Array(colorsBuffer.getMappedRange()).set(colorsData);
colorsBuffer.unmap();

const indicesData = geometry.indices.data;
const indicesBuffer = device.createBuffer({
    size: indicesData.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true
});
new Uint16Array(indicesBuffer.getMappedRange()).set(indicesData);
indicesBuffer.pointNum = indicesData.length;
indicesBuffer.unmap();

const uniformComponentCount = 16;
const uniformBufferSize = uniformComponentCount * 4;
const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

const uniformsBindGroupLayout = device.createBindGroupLayout({
    entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
            type: 'uniform',
        },
    }]
});

const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [uniformsBindGroupLayout] });
const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
        module: device.createShaderModule({
            code: glslang.compileGLSL(vs, "vertex")
        }),
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
        module: device.createShaderModule({
            code: glslang.compileGLSL(fs, "fragment")
        }),
        entryPoint: "main",
        targets: [
            {
                format: swapChainFormat
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

const uniformBindGroup = device.createBindGroup({
    layout: uniformsBindGroupLayout,
    entries: [{
        binding: 0,
        resource: {
            buffer: uniformBuffer,
        },
    }],
});

const vertexUniformData = new Float32Array(uniformComponentCount);
function getModelMatrix(){
    vertexUniformData.set(Hilo3d.semantic.MODELVIEWPROJECTION.get(mesh), 0);
    return vertexUniformData;
}

const depthTexture = device.createTexture({
    size: {
        width: canvas.width,
        height: canvas.height,
        depthOrArrayLayers: 1
    },
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
});

function render() {
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor = {
        colorAttachments: [{
            view: textureView,
            loadValue: {r: 1, g: 1, b: 1, a: 1},
            storeOp: "store"
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthLoadValue: 1.0,
            depthStoreOp: "store",
            stencilLoadValue: 0,
            stencilStoreOp: "store"
        }
    };
    device.queue.writeBuffer(uniformBuffer, 0, getModelMatrix());

    const commandEncoder = device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.setVertexBuffer(1, colorsBuffer);
    passEncoder.setIndexBuffer(indicesBuffer, "uint16");
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.drawIndexed(geometry.indices.count, 1, 0, 0, 0);
    passEncoder.endPass();

    device.queue.submit([commandEncoder.finish()]);
}

const ticker = new Hilo3d.Ticker(60);
ticker.start();
ticker.addTick({
    tick(dt){
        Hilo3d.semantic.init({}, {}, camera);
        stage.traverseUpdate(dt);
        stage.updateMatrixWorld();
        camera.updateViewProjectionMatrix();

        render();
    }
});

})();
