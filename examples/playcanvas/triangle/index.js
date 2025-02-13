import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

const gfxOptions = {
    deviceTypes: ['webgpu'],
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

const device = await pc.createGraphicsDevice(canvas, gfxOptions);
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

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
camera.setLocalPosition(0, 0, 3);
app.root.addChild(camera);

const light = new pc.Entity();
light.addComponent('light', {
    type: 'directional'
});
app.root.addChild(light);
light.setLocalEulerAngles(45, 30, 0);

const positions = [ 
    0.0, 0.5, 0.0, // v0
   -0.5,-0.5, 0.0, // v1
    0.5,-0.5, 0.0  // v2
];

const normals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1
];

const indices = [0, 1, 2];

const mesh = new pc.Mesh(device);

mesh.setPositions(positions);
mesh.setNormals(normals);
mesh.setIndices(indices);
mesh.update(pc.PRIMITIVE_TRIANGLES);

const material = new pc.StandardMaterial();
material.diffuse = new pc.Color(0, 0, 1);
material.update();

const meshInstance = new pc.MeshInstance(mesh, material);

const entity = new pc.Entity();
entity.addComponent('render', {
    meshInstances: [meshInstance]
});
app.root.addChild(entity);
