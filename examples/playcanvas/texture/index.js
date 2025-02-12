import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

const gfxOptions = {
    deviceTypes: ['webgpu'],
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

const assets = {
    frog: new pc.Asset('frog', 'texture', { url: `../../../assets/textures/frog.jpg` })
};

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

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);

const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
assetListLoader.load(() => {
    app.start();

    app.scene.ambientLight = new pc.Color(1, 1, 1);

    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.frog.resource;
    material.update();

    const box = new pc.Entity();
    box.addComponent('render', {
        type: 'box',
        material: material
    });

    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(1, 1, 1)
    });

    app.root.addChild(box);
    app.root.addChild(camera);
    camera.translate(0, 0, 3);

    app.on('update', (dt) => {
        box.rotate(10 * dt, 20 * dt, 30 * dt);
    });
});
