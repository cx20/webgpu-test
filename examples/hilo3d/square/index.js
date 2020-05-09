(async()=>{
const canvas = document.querySelector('#c');
canvas.width = innerWidth;
canvas.height = innerHeight;
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const glslang = await glslangModule();

const stage = new Hilo3d.Node();
const camera = new Hilo3d.PerspectiveCamera({
});

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
//         |      / |
//         |    /   |
//         |  /     |
//        [2]------[3]
//
const positions = [ 
    -0.5, 0.5, 0.0, // v0
     0.5, 0.5, 0.0, // v1
    -0.5,-0.5, 0.0, // v2
     0.5,-0.5, 0.0  // v3
];

const colors = [ 
    1.0, 0.0, 0.0, 1.0, // v0
    0.0, 1.0, 0.0, 1.0, // v1
    0.0, 0.0, 1.0, 1.0, // v2
    1.0, 1.0, 0.0, 1.0  // v3
];

const indices = [
  2, 0, 1, // v2-v0-v1
  2, 1, 3  // v2-v1-v3
];

const geometry = new Hilo3d.Geometry({
    vertices: new Hilo3d.GeometryData(new Float32Array(positions), 3),
    colors: new Hilo3d.GeometryData(new Float32Array(colors), 4),
    indices: new Hilo3d.GeometryData(new Uint16Array(indices), 1)
});

const mesh = new Hilo3d.Mesh({
    geometry: geometry,
    material: new Hilo3d.BasicMaterial({
    }),
    onUpdate: function() {
    }
});

stage.addChild(camera);
stage.addChild(mesh);

const vs = document.getElementById("vs").textContent;
const fs = document.getElementById("fs").textContent;

const context = canvas.getContext('gpupresent');

const swapChainFormat = "bgra8unorm";

const swapChain = context.configureSwapChain({
    device,
    format: swapChainFormat,
});

const verticesData = geometry.vertices.data;
const verticesBuffer = device.createBuffer({
    size: verticesData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
verticesBuffer.setSubData(0, verticesData);

const colorsData = geometry.colors.data;
const colorsBuffer = device.createBuffer({
    size: colorsData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
});
colorsBuffer.setSubData(0, colorsData);

const indicesData = geometry.indices.data;
const indicesBuffer = device.createBuffer({
    size: indicesData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
});
indicesBuffer.setSubData(0, indicesData);

const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [] });
const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertexStage: {
        module: device.createShaderModule({
            code: glslang.compileGLSL(vs, "vertex")
        }),
        entryPoint: "main"
    },
    fragmentStage: {
        module: device.createShaderModule({
            code: glslang.compileGLSL(fs, "fragment")
        }),
        entryPoint: "main"
    },
    primitiveTopology: "triangle-strip",
    rasterizationState: {
        cullMode: 'back',
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
    vertexState: {
        vertexBuffers:[{
            arrayStride: 3 * 4,
            attributes:[{
                shaderLocation: 0,
                offset: 0,
                format: "float3"
            }]
        },
        {
            arrayStride: 4 * 4,
            attributes: [{
                // color
                shaderLocation: 1,
                offset:  0,
                format: "float4"
            }]
        }],
        indexFormat: 'uint16'
    }
});

const renderPassDescriptor = {
    colorAttachments: [{
        attachment: null,
        loadValue: {r: 1, g: 1, b: 1, a: 1},
    }],
};  

function render() {
    renderPassDescriptor.colorAttachments[0].attachment = swapChain.getCurrentTexture().createView();

    const commandEncoder = device.createCommandEncoder({});
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.setVertexBuffer(1, colorsBuffer);
    passEncoder.setIndexBuffer(indicesBuffer);
    passEncoder.drawIndexed(geometry.indices.count, 1, 0, 0);
    passEncoder.endPass();

    device.defaultQueue.submit([commandEncoder.finish()]);
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
