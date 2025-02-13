import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

const gfxOptions = {
    deviceTypes: ['webgpu'],
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.start();

app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(1, 1, 1)
});
camera.setPosition(0, 0, 2);
app.root.addChild(camera);

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
const positions = new Float32Array([
    -0.5,  0.5, 0.0, // v0
     0.5,  0.5, 0.0, // v1 
    -0.5, -0.5, 0.0, // v2
     0.5, -0.5, 0.0  // v3
]);

const normals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1 
];

const colors = new Float32Array([
    1.0, 0.0, 0.0, 1.0, // v0
    0.0, 1.0, 0.0, 1.0, // v1
    0.0, 0.0, 1.0, 1.0, // v2
    1.0, 1.0, 0.0, 1.0  // v3
]);

const indices = new Uint16Array([
    2, 0, 1, // v2-v0-v1
    2, 1, 3  // v2-v1-v3
]);
const mesh = new pc.Mesh(device);

mesh.setPositions(positions);
mesh.setNormals(normals);
mesh.setColors(colors);
mesh.setIndices(indices);
mesh.update(pc.PRIMITIVE_TRIANGLES);

const material = new pc.StandardMaterial();
material.diffuseVertexColor = true;
material.cull = pc.CULLFACE_NONE;
material.update();

const meshInstance = new pc.MeshInstance(mesh, material);

const entity = new pc.Entity();
entity.addComponent('render', {
    meshInstances: [meshInstance]
});
app.root.addChild(entity);

const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional',
    color: pc.Color.WHITE,
    castShadows: false
});
light.setLocalEulerAngles(45, 30, 0);
app.root.addChild(light);

window.addEventListener('resize', () => {
    app.resizeCanvas();
});