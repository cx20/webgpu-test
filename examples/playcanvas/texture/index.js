import * as pc from 'playcanvas';

const assets = {
    'frog': new pc.Asset('frog.jpg', 'texture', { url: 'https://cx20.github.io/webgpu-test/assets/textures/frog.jpg' }),
};

const vertexShaderGLSL = /* glsl */`
attribute vec4 vertex_position;
attribute vec2 vertex_texCoord0;

varying vec2 uv;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;

void main() {
    vec4 worldPos = matrix_model * vertex_position;
    gl_Position = matrix_viewProjection * worldPos;
    uv = vertex_texCoord0;
}
`;

const fragmentShaderGLSL = /* glsl */`
precision highp float;
varying vec2 uv;

uniform sampler2D texture_emissiveMap;

void main() {
    vec4 tex = texture2D(texture_emissiveMap, uv);
    gl_FragColor = vec4(tex);
}
`;

function createPrimitive(app, primitiveType, shader, position, scale) {

    const material = new pc.Material();
    material.shader = shader;
    material.setParameter('texture_emissiveMap', assets.frog.resource);

    // create primitive
    const primitive = new pc.Entity(primitiveType);
    primitive.addComponent('render', {
        type: primitiveType,
        material: material
    });

    // set position and scale and add it to scene
    primitive.setLocalPosition(position);
    primitive.setLocalScale(scale);
    app.root.addChild(primitive);

    return primitive;
}

function onLoaded(app) {

    app.start();

    // Create the shader definition and shader from the vertex and fragment shaders
    const shaderDefinition = {
        attributes: {
            vertex_position: pc.SEMANTIC_POSITION,
            vertex_texCoord0: pc.SEMANTIC_TEXCOORD0
        },
        vshader: vertexShaderGLSL,
        fshader: fragmentShaderGLSL
    };
    const shader = new pc.Shader(app.graphicsDevice, shaderDefinition);

    const entities = [];
    entities.push(createPrimitive(app, "box", shader, pc.Vec3.ZERO, new pc.Vec3(3, 3, 3)));

    // Create an entity with a camera component
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(1, 1, 1, 1)
    });
    app.root.addChild(camera);
    camera.setLocalPosition(0, 0, 10);

    let time = 0;
    const rot = new pc.Quat();
    app.on("update", function (dt) {
        time += dt;

        rot.setFromEulerAngles(50 * time, 50 * time, 50 * time);
        entities[0].setRotation(rot);
    });

}

function main() {

    console.log("example start");

    pc.Tracing.set(pc.TRACEID_SHADER_ALLOC, true);

    const canvas = document.querySelector('#gpuCanvas');
    const gfxOptions = {
        deviceTypes: [pc.DEVICETYPE_WEBGPU],
        // TODO: Investigate how to reference external libraries.
        glslangUrl: 'https://raw.githubusercontent.com/playcanvas/engine/bd6256e83eadb065d4a5810959555200a9db4c9a/examples/src/lib/glslang/glslang.js',
        twgslUrl: 'https://raw.githubusercontent.com/playcanvas/engine/bd6256e83eadb065d4a5810959555200a9db4c9a/examples/src/lib/twgsl/twgsl.js'
    };
    pc.createGraphicsDevice(canvas, gfxOptions).then((graphicsDevice) => {

        console.log("Graphics Device created: ", graphicsDevice);

        const createOptions = new pc.AppOptions();
        createOptions.graphicsDevice = graphicsDevice;

        createOptions.componentSystems = [
            pc.RenderComponentSystem,
            pc.CameraComponentSystem,
            pc.LightComponentSystem,
        ];
        createOptions.resourceHandlers = [
            pc.TextureHandler,
            pc.ContainerHandler
        ];

        const app = new pc.AppBase(canvas);
        app.init(createOptions);

        const lighting = app.scene.lighting;
        lighting.shadowsEnabled = false;
        lighting.cookiesEnabled = false;

        const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            onLoaded(app);
        });

    }).catch(console.error);
}

window.addEventListener('load', main);
