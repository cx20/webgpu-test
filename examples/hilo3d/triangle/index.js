(async()=>{
const canvas = document.querySelector('#c');
canvas.width = innerWidth;
canvas.height = innerHeight;
const gpu = navigator["gpu"];
const adapter = await gpu.requestAdapter();
const device = await adapter.requestDevice();

const stage = new Hilo3d.Node();
const camera = new Hilo3d.PerspectiveCamera({
});

const positions = [
     0.0, 0.5, 0.0, // v0
    -0.5,-0.5, 0.0, // v1
     0.5,-0.5, 0.0  // v2
];

const geometry = new Hilo3d.Geometry({
    vertices:new Hilo3d.GeometryData(new Float32Array(positions), 3),
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

const context = canvas.getContext('webgpu');
const format = gpu.getPreferredCanvasFormat();
context.configure({
    device: device,
    format: format,
    alphaMode: "opaque"
});

const verticesData = geometry.vertices.data;
const verticesBuffer = device.createBuffer({
    size: verticesData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
});
new Float32Array(verticesBuffer.getMappedRange()).set(verticesData);
verticesBuffer.unmap();

const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [] });
const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
        module: device.createShaderModule({
            code: vs
        }),
        entryPoint: "main",
        buffers:[{
            arrayStride: 3 * 4,
            attributes:[{
                shaderLocation: 0,
                offset: 0,
                format: 'float32x3'
            }]
        }]
    },
    fragment: {
        module: device.createShaderModule({
            code: fs
        }),
        entryPoint: 'main',
        targets:[{
            format: format
        }]
    },
    primitive:{
        topology: 'triangle-list'
    }
});


function render() {
    const commandEncoder = device.createCommandEncoder({});
    const textureView = context.getCurrentTexture().createView();
    const renderPassDescriptor = {
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            clearValue: {r: 1, g: 1, b: 1, a: 1},
            storeOp: "store"
        }],
    };  

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    passEncoder.draw(3, 1, 0, 0);
    passEncoder.end();

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
