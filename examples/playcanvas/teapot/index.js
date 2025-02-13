import * as pc from 'playcanvas';

const canvas = document.getElementById('gpuCanvas');

const gfxOptions = {
    deviceTypes: ['webgpu'],
    glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
    twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
};

const assets = {
    texture: new pc.Asset('metal', 'texture', { 
        url: '../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg' 
    }),
    teapot: new pc.Asset('teapot', 'json', { 
        url: '../../../assets/json/teapot.json' 
    })
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
    pc.TextureHandler,
    pc.JsonHandler
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

    const camera = new pc.Entity();
    camera.addComponent('camera', {
        clearColor: new pc.Color(0, 0, 0),
        farClip: 1000,
        fov: 45
    });
    camera.setPosition(0, 0, 50);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    const light = new pc.Entity();
    light.addComponent('light', {
        type: "directional",
        color: new pc.Color(1, 1, 1)
    });
    light.setEulerAngles(90, 30, 0);
    app.root.addChild(light);

    const teapotData = assets.teapot.resource;
    const vertexPositions     = new Float32Array(teapotData.vertexPositions);
    const vertexTextureCoords = new Float32Array(teapotData.vertexTextureCoords);
    const vertexNormals       = new Float32Array(teapotData.vertexNormals);
    const indices             = new Uint16Array(teapotData.indices);

    const mesh = new pc.Mesh(device);
    mesh.setPositions(vertexPositions);
    mesh.setUvs(0, vertexTextureCoords);
    mesh.setNormals(vertexNormals);
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);

    const material = new pc.StandardMaterial();
    material.diffuseMap = assets.texture.resource;
    material.cull = pc.CULLFACE_NONE;
    material.update();

    const meshInstance = new pc.MeshInstance(mesh, material);

    const entity = new pc.Entity();
    entity.addComponent('render', {
        meshInstances: [meshInstance]
    });
    app.root.addChild(entity);

    app.on('update', (dt) => {
        entity.rotate(0, dt * 50, 0);
    });

    window.addEventListener('resize', () => {
        app.resizeCanvas();
    });
});
