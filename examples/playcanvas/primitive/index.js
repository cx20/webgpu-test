import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

// WebGPU specific options
const gfxOptions = {
    deviceTypes: ['webgpu'],
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

// Asset definition
const assets = {
    earth: new pc.Asset('earth', 'texture', { url: '../../../assets/textures/earth.jpg' })
};

// Initialize WebGPU device and create app
const device = await pc.createGraphicsDevice(canvas, gfxOptions);
const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.LightComponentSystem
];
createOptions.resourceHandlers = [
    pc.TextureHandler
];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Handle window resize
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

// Load assets and initialize scene
const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    // Set ambient light
    app.scene.ambientLight = new pc.Color(1, 1, 1);

    // Create material
    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.earth.resource;
    material.update();

    // Create camera
    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0),
        farClip: 1000,
        fov: 45
    });
    camera.translate(0, 0, 5);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    // Create primitives
    // Plane
    const plane = new pc.Entity();
    plane.addComponent('render', {
        type: 'plane',
        material: material
    });
    plane.setLocalPosition(-1.5, 1.0, 0.0);
    plane.rotate(90, 0, 0);
    app.root.addChild(plane);

    // Cube
    const cube = new pc.Entity();
    cube.addComponent('render', {
        type: 'box',
        material: material
    });
    cube.setLocalPosition(0.0, 1.0, 0.0);
    app.root.addChild(cube);

    // Sphere
    const sphere = new pc.Entity();
    sphere.addComponent('render', {
        type: 'sphere',
        material: material
    });
    sphere.setLocalPosition(1.5, 1.0, 0.0);
    app.root.addChild(sphere);

    // Capsule
    const capsule = new pc.Entity();
    capsule.addComponent('render', {
        type: 'capsule',
        material: material
    });
    capsule.setLocalPosition(-1.5, -1.0, 0.0);
    app.root.addChild(capsule);

    // Cone
    const cone = new pc.Entity();
    cone.addComponent('render', {
        type: 'cone',
        material: material
    });
    cone.setLocalPosition(0.0, -1.0, 0.0);
    app.root.addChild(cone);

    // Cylinder
    const cylinder = new pc.Entity();
    cylinder.addComponent('render', {
        type: 'cylinder',
        material: material
    });
    cylinder.setLocalPosition(1.5, -1.0, 0.0);
    app.root.addChild(cylinder);

    // Update function for rotation
    app.on('update', (dt) => {
        plane.rotate(0, dt * 50, 0);
        cube.rotate(0, dt * 50, 0);
        sphere.rotate(0, dt * 50, 0);
        capsule.rotate(0, dt * 50, 0);
        cone.rotate(0, dt * 50, 0);
        cylinder.rotate(0, dt * 50, 0);
    });
});