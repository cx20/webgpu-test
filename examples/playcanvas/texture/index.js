import { Asset } from "src/framework/asset/asset.js";
import { AssetListLoader } from "src/framework/asset/asset-list-loader.js";
import { AppBase } from "src/framework/app-base.js";
import { AppOptions } from "src/framework/app-options.js";
import { createGraphicsDevice } from 'src/platform/graphics/graphics-device-create.js';
import { Shader } from 'src/platform/graphics/shader.js';
import { Texture } from 'src/platform/graphics/texture.js';
import { RenderTarget } from 'src/platform/graphics/render-target.js';
import {
    DEVICETYPE_WEBGPU,
    SEMANTIC_TEXCOORD0, SEMANTIC_POSITION, CULLFACE_NONE,
    PIXELFORMAT_RGBA8, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE
} from 'src/platform/graphics/constants.js';
import { Entity } from "src/framework/entity.js";
import { Tracing } from "src/core/tracing.js";
import { 
    TRACEID_RENDER_FRAME, TRACEID_RENDER_PASS, TRACEID_RENDER_PASS_DETAIL, TRACEID_SHADER_ALLOC, TRACEID_TEXTURE_ALLOC
} from "src/core/constants.js";
import { Color } from "src/core/math/color.js";
import { Vec3 } from "src/core/math/vec3.js";
import { Quat } from "src/core/math/quat.js";
import { StandardMaterial } from "src/scene/materials/standard-material.js";

import { Material } from "src/scene/materials/material.js";
import { RenderComponentSystem } from 'src/framework/components/render/system.js';
import { CameraComponentSystem } from 'src/framework/components/camera/system.js';
import { LightComponentSystem } from 'src/framework/components/light/system.js';
import { TextureHandler } from 'src/framework/handlers/texture.js';
import { ContainerHandler } from 'src/framework/handlers/container.js';

const assets = {
    'frog': new Asset('frog.jpg', 'texture', { url: 'https://cx20.github.io/webgpu-test/assets/textures/frog.jpg' }),
};

const vertexShaderGLSL = /* glsl */`

#version 450

// in
attribute vec4 vertex_position;
attribute vec2 vertex_texCoord0;

// out
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
#version 450

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

// in 
varying vec2 uv;

// out - TODO: use shader intro which handles this per platform
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

uniform sampler2D texture_emissiveMap;

void main() {
vec4 tex = texture2D(texture_emissiveMap, uv);
gl_FragColor = vec4(tex);
}
`;

function createPrimitive(app, primitiveType, shader, position, scale) {

    const material = new Material();
    material.shader = shader;
    material.setParameter('texture_emissiveMap', assets.frog.resource);

    // create primitive
    const primitive = new Entity(primitiveType);
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
            vertex_position: SEMANTIC_POSITION,
            vertex_texCoord0: SEMANTIC_TEXCOORD0
        },
        vshader: vertexShaderGLSL,
        fshader: fragmentShaderGLSL
    };
    const shader = new Shader(app.graphicsDevice, shaderDefinition);

    const entities = [];
    entities.push(createPrimitive(app, "box", shader, Vec3.ZERO, new Vec3(3, 3, 3)));

    // Create an entity with a camera component
    const camera = new Entity();
    camera.addComponent("camera", {
        clearColor: new Color(1, 1, 1, 1)
    });
    app.root.addChild(camera);
    camera.setLocalPosition(0, 0, 10);

    let time = 0;
    const rot = new Quat();
    app.on("update", function (dt) {
        time += dt;

        rot.setFromEulerAngles(50 * time, 50 * time, 50 * time);
        entities[0].setRotation(rot);
    });

}

function main() {

    console.log("example start");

    Tracing.set(TRACEID_SHADER_ALLOC, true);

    const canvas = document.querySelector('#gpuCanvas');
    const gfxOptions = {
        deviceTypes: [DEVICETYPE_WEBGPU],
        glslangUrl: 'https://rawcdn.githack.com/playcanvas/engine/bd6256e83eadb065d4a5810959555200a9db4c9a/examples/src/lib/glslang/glslang.js',
        twgslUrl: 'https://rawcdn.githack.com/playcanvas/engine/bd6256e83eadb065d4a5810959555200a9db4c9a/examples/src/lib/twgsl/twgsl.js'
    };
    createGraphicsDevice(canvas, gfxOptions).then((graphicsDevice) => {

        console.log("Graphics Device created: ", graphicsDevice);

        const createOptions = new AppOptions();
        createOptions.graphicsDevice = graphicsDevice;

        createOptions.componentSystems = [
            RenderComponentSystem,
            CameraComponentSystem,
            LightComponentSystem,
        ];
        createOptions.resourceHandlers = [
            TextureHandler,
            ContainerHandler
        ];

        const app = new AppBase(canvas);
        app.init(createOptions);

        const lighting = app.scene.lighting;
        lighting.shadowsEnabled = false;
        lighting.cookiesEnabled = false;

        const assetListLoader = new AssetListLoader(Object.values(assets), app.assets);
        assetListLoader.load(() => {
            onLoaded(app);
        });

    }).catch(console.error);
}

window.addEventListener('load', main);
