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
    clearColor: new pc.Color(1, 1, 1),
    farClip: 1000,
    fov: 45
});
camera.setPosition(0, 0, 2.5);
camera.lookAt(0, 0, 0);
app.root.addChild(camera);

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
const positions = new Float32Array([
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
]);

const normals = new Float32Array([
    // Front
    0, 0, 1,    0, 0, 1,    0, 0, 1,    0, 0, 1,
    // Back
    0, 0, -1,   0, 0, -1,   0, 0, -1,   0, 0, -1,
    // Top
    0, 1, 0,    0, 1, 0,    0, 1, 0,    0, 1, 0,
    // Bottom
    0, -1, 0,   0, -1, 0,   0, -1, 0,   0, -1, 0,
    // Right
    1, 0, 0,    1, 0, 0,    1, 0, 0,    1, 0, 0,
    // Left
    -1, 0, 0,   -1, 0, 0,   -1, 0, 0,   -1, 0, 0
]);

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
    for (let j = 0; j < 4; j++) {
        unpackedColors = unpackedColors.concat(color);
    }
}
const finalColors = new Float32Array(unpackedColors);

const indices = new Uint16Array([
    0,  1,  2,    0,  2,  3,  // Front
    4,  5,  6,    4,  6,  7,  // Back
    8,  9,  10,   8,  10, 11, // Top
    12, 13, 14,   12, 14, 15, // Bottom
    16, 17, 18,   16, 18, 19, // Right
    20, 21, 22,   20, 22, 23  // Left
]);

const mesh = new pc.Mesh(device);
mesh.setPositions(positions);
mesh.setNormals(normals);
mesh.setColors(finalColors);
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

app.on('update', (dt) => {
    entity.rotate(dt * 50, dt * 50, dt * 50);
});

window.addEventListener('resize', () => {
    app.resizeCanvas();
});