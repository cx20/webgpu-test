import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

const gfxOptions = {
    deviceTypes: ['webgpu'],
    // TODO: Investigate how to reference external libraries.
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

pc.createGraphicsDevice(canvas, gfxOptions).then((device) => {
    device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

    const createOptions = new pc.AppOptions();
    createOptions.graphicsDevice = device;

    createOptions.componentSystems = [
        pc.RenderComponentSystem,
        pc.CameraComponentSystem,
        pc.LightComponentSystem
    ];

    createOptions.resourceHandlers = [
        pc.TextureHandler,
        pc.ContainerHandler
    ];

    const app = new pc.AppBase(canvas);
    app.init(createOptions);

    function getTexture() {
        const texture = new pc.Texture(device, { width: 256, height: 256 });
        
        const img = new Image();
        img.onload = function () {
            texture.minFilter = pc.FILTER_LINEAR;
            texture.magFilter = pc.FILTER_LINEAR;
            texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            texture.setSource(img);
        };
        img.src = "../../../assets/textures/frog.jpg";  // 256x256
        return texture;
    };
    
    const material = new pc.StandardMaterial();
    material.diffuseMap = getTexture();
    material.update();

    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    const resize = () => app.resizeCanvas();
    window.addEventListener('resize', resize);
    app.on('destroy', () => {
        window.removeEventListener('resize', resize);
    });

    const box = new pc.Entity('cube');
    box.addComponent('render', {
        type: 'box',
        material: material
    });
    app.root.addChild(box);

    const camera = new pc.Entity('camera');
    camera.addComponent('camera', {
        clearColor: new pc.Color(0.5, 0.6, 0.9)
    });
    app.root.addChild(camera);
    camera.setPosition(0, 0, 3);

    const light = new pc.Entity('light');
    light.addComponent('light');
    app.root.addChild(light);
    light.setEulerAngles(45, 0, 0);

    app.on('update', (dt) => box.rotate(10 * dt, 20 * dt, 30 * dt));

    app.start();
});
