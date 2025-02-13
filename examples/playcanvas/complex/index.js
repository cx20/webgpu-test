import * as pc from 'playcanvas';
import { CameraControls } from 'camera-controls';

// Calculate entity bounding box
const calcEntityAABB = (bbox, entity) => {
    bbox.center.set(0, 0, 0);
    bbox.halfExtents.set(0, 0, 0);
    entity.findComponents('render').forEach((render) => {
        render.meshInstances.forEach((mi) => {
            bbox.add(mi.aabb);
        });
    });
    return bbox;
};

let modelInfoSet = [
{
    name: "CesiumMilkTruck",
    scale: 0.4,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, -2],
    url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"
}, {
    name: "Fox",
    scale: 0.05,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 0],
    url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"
}, {
    name: "Rex",
    scale: 1.0,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 3],
    url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"
}];

const getAbsolutePathFromRelativePath = function(href) {
    var link = document.createElement("a");
    link.href = href;
    return link.href;
}

class Viewer {
    constructor(canvas) {
        // WebGPU specific options
        const gfxOptions = {
            deviceTypes: ['webgpu'],
            glslangUrl: 'https://unpkg.com/@webgpu/glslang@0.0.15/dist/web-devel/glslang.js',
            twgslUrl: 'https://cx20.github.io/webgpu-test/libs/twgsl.js'
        };

        // Initialize WebGPU device
        this.initializeWebGPU(canvas, gfxOptions);
    }

    async initializeWebGPU(canvas, gfxOptions) {
        try {
            const device = await pc.createGraphicsDevice(canvas, gfxOptions);
            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.componentSystems = [
                pc.RenderComponentSystem,
                pc.CameraComponentSystem,
                pc.LightComponentSystem,
                pc.AnimComponentSystem,
                pc.ModelComponentSystem,
                pc.ScriptComponentSystem
            ];
            createOptions.resourceHandlers = [
                pc.TextureHandler,
                pc.ContainerHandler,
                pc.AnimClipHandler,
                pc.AnimStateGraphHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set up input devices
            const mouse = new pc.Mouse(canvas);
            const touch = new pc.TouchDevice(canvas);
            app.mouse = mouse;
            app.touch = touch;

            this.app = app;
            this.setupApplication();
        } catch (error) {
            console.error('Failed to initialize WebGPU:', error);
        }
    }

    setupApplication() {
        const app = this.app;
        const getCanvasSize = () => ({
            width: window.innerWidth,
            height: window.innerHeight
        });

        app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

        const canvasSize = getCanvasSize();
        app.setCanvasFillMode(pc.FILLMODE_NONE, canvasSize.width, canvasSize.height);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        window.addEventListener("resize", () => {
            const canvasSize = getCanvasSize();
            app.resizeCanvas(canvasSize.width, canvasSize.height);
        });

        // Setup skybox
        let cubemapAsset = new pc.Asset('papermill', 'cubemap', {
            url: "https://cx20.github.io/gltf-test/textures/dds/papermill.dds"
        }, {
            "textures": [
                "https://cx20.github.io/gltf-test/textures/cube/skybox/px.jpg",
                "https://cx20.github.io/gltf-test/textures/cube/skybox/nx.jpg",
                "https://cx20.github.io/gltf-test/textures/cube/skybox/py.jpg",
                "https://cx20.github.io/gltf-test/textures/cube/skybox/ny.jpg",
                "https://cx20.github.io/gltf-test/textures/cube/skybox/pz.jpg",
                "https://cx20.github.io/gltf-test/textures/cube/skybox/nz.jpg",
            ],
            "magFilter": 1,
            "minFilter": 5,
            "anisotropy": 1,
            "name": "Papermill",
            "prefiltered": "papermill.dds"
        });

        cubemapAsset.ready(() => {
            app.scene.gammaCorrection = pc.GAMMA_SRGB;
            app.scene.toneMapping = pc.TONEMAP_ACES;
            app.scene.skyboxMip = 0;
            for (let i = 1; i < cubemapAsset.resources.length; i++ ) {
                cubemapAsset.resources[i].type = "rgbm";
            }
            app.scene.setSkybox(cubemapAsset.resources);
        });

        app.assets.add(cubemapAsset);
        cubemapAsset.loadFaces = true;
        app.assets.load(cubemapAsset);

        // Create camera
        const camera = new pc.Entity('Camera');
        camera.addComponent('camera', {
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            fov: 60
        });
        camera.addComponent('script');
        const start = new pc.Vec3(0, 1, 5);
        camera.setPosition(start);
        app.root.addChild(camera);

        // Setup camera controls
        const script = camera.script.create(CameraControls, {
            properties: {
                enableFly: false,
                focusPoint: new pc.Vec3(0, 0, 0),
                sceneSize: 10,
                enablePan: true,
                focusDamping: 0.4,
                pitchRange: new pc.Vec2(-89, 89),
                rotateSpeed: 0.3,
                rotateDamping: 0.4,
                zoomSpeed: 0.005,
                zoomPinchSens: 0.3,
                zoomDamping: 0.4,
                zoomMin: 1,
                zoomMax: 100
            }
        });

        // Add keyboard controls
        const onKeyDown = (e) => {
            switch (e.key) {
                case 'f': {
                    if (this.entity) {
                        const bbox = calcEntityAABB(new pc.BoundingBox(), this.entity);
                        script.refocus(bbox.center, null, null, true);
                    }
                    break;
                }
                case 'r': {
                    script.refocus(new pc.Vec3(0, 0, 0), start, 30, true);
                    break;
                }
            }
        };
        window.addEventListener('keydown', onKeyDown);
        app.on('destroy', () => {
            window.removeEventListener('keydown', onKeyDown);
        });

        // Load models
        for (let i = 0; i < modelInfoSet.length; i++) {
            let m = modelInfoSet[i];
            let url = m.url;
            var filename = url.split('/').pop();
            this.load(url, filename);
        }

        // Start the application
        app.start();

        // Create light
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1, 1, 1),
            castShadows: true,
            intensity: 2,
            shadowBias: 0.2,
            shadowDistance: 5,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        // Create ground planes
        let material = new pc.StandardMaterial();
        material.update();

        let ground1 = new pc.Entity();
        ground1.addComponent('render', {
            type: 'plane',
            material: material
        });
        ground1.setLocalPosition(-49.5, 0.0, -1.6);
        ground1.rotate(0, 0, 0);
        var scale = ground1.getLocalScale();
        scale.x = 100.0;
        scale.y = 0.1;
        scale.z = 0.1;
        ground1.setLocalScale(scale);
        app.root.addChild(ground1);

        let ground2 = new pc.Entity();
        ground2.addComponent('render', {
            type: 'plane',
            material: material
        });
        ground2.setLocalPosition(-49.5, 0.0, -2.35);
        ground2.rotate(0, 0, 0);
        var scale = ground2.getLocalScale();
        scale.x = 100.0;
        scale.y = 0.1;
        scale.z = 0.1;
        ground2.setLocalScale(scale);
        app.root.addChild(ground2);

        // Disable autorender
        app.autoRender = false;
        this.prevCameraMat = new pc.Mat4();
        app.on('update', this.update.bind(this));

        // Store references
        this.camera = camera;
        this.cameraScript = script;
        this.light = light;
        this.entity = null;
    }

    resetScene() {
        const app = this.app;

        const entity = this.entity;
        if (entity) {
            app.root.removeChild(entity);
            entity.destroy();
            this.entity = null;
        }

        if (this.asset) {
            app.assets.remove(this.asset);
            this.asset.unload();
            this.asset = null;
        }

        this.animationMap = { };
        //onAnimationsLoaded([]);
    }

    focusCamera() {
        const entity = this.entity;
        if (entity) {
            const camera = this.camera;

            const orbitCamera = camera.script.orbitCamera;
            orbitCamera.focus(entity);

            const distance = orbitCamera.distance;
            camera.camera.nearClip = distance / 10;
            camera.camera.farClip = distance * 10;

            const light = this.light;
            light.light.shadowDistance = distance * 2;
        }
    }

    load(url, filename) {
        // New way to load assets in PlayCanvas
        const asset = new pc.Asset(filename, 'container', { url: url });
        asset.on('load', () => {
            this._onLoaded(null, asset);
        });
        asset.on('error', (err) => {
            this._onLoaded(err, null);
        });
        this.app.assets.add(asset);
        this.app.assets.load(asset);
    }

    play(animationName) {
        if (this.entity && this.entity.animation) {
            if (animationName) {
                this.entity.animation.play(this.animationMap[animationName], 1);
            } else {
                this.entity.animation.playing = true;
            }
        }
    }

    stop() {
        if (this.entity && this.entity.animation) {
            this.entity.animation.playing = false;
        }
    }

    setSpeed(speed) {
        if (this.entity && this.entity.animation) {
            const entity = this.entity;
            if (entity) {
                entity.animation.speed = speed;
            }
        }
    }

    update() {
        // if the camera has moved since the last render
        const cameraWorldTransform = this.camera.getWorldTransform();
        if (!this.prevCameraMat.equals(cameraWorldTransform)) {
            this.prevCameraMat.copy(cameraWorldTransform);
            this.app.renderNextFrame = true;
        }
        // or an animation is loaded and we're animating
        if (this.entity && this.entity.animation && this.entity.animation.playing) {
            this.app.renderNextFrame = true;
        }
    }

    _onLoaded(err, asset) {
        if (!err && asset.resource) {

            //this.resetScene();

            const resource = asset.resource;

            // create entity and add model
            const entity = new pc.Entity();
            entity.addComponent("model", {
                type: "asset",
                asset: resource.model,
                castShadows: true
            });
                
            if (asset.name === "CesiumMilkTruck.gltf") {
                let m = modelInfoSet[0];
                applyModelInfoToEntity(m, entity);
            } else if (asset.name === "Fox.gltf") {
                let m = modelInfoSet[1];
                applyModelInfoToEntity(m, entity);
            } else if (asset.name === "trex.gltf") {
                let m = modelInfoSet[2];
                applyModelInfoToEntity(m, entity);
            }
            function applyModelInfoToEntity(m, entity) { 
                const s = entity.getLocalScale();
                const r = entity.getLocalRotation();
                const p = entity.getLocalPosition();
                s.x = s.x * m.scale;
                s.y = s.y * m.scale;
                s.z = s.z * m.scale;
                r.setFromEulerAngles(
                    m.rotation[0] / (2 * Math.PI) * 360,
                    m.rotation[1] / (2 * Math.PI) * 360,
                    m.rotation[2] / (2 * Math.PI) * 360);
                p.x = p.x + m.position[0];
                p.y = p.y + m.position[1];
                p.z = p.z + m.position[2];
                entity.setLocalScale(s);
                entity.setLocalRotation(r);
                entity.setLocalPosition(p);
            }

            // create animations
            if (resource.animations && resource.animations.length > 0) {
                entity.addComponent('animation', {
                    assets: resource.animations.map(function (asset) {
                        return asset.id;
                    }),
                    speed: 1
                });

                const animationMap = {};
                for (let i = 0; i < resource.animations.length; ++i) {
                    const animAsset = resource.animations[i];
                    animationMap[animAsset.resource.name] = animAsset.name;
                }

                this.animationMap = animationMap;
                //onAnimationsLoaded(Object.keys(this.animationMap));
            }

            this.app.root.addChild(entity);
            this.entity = entity;
            this.asset = asset;

            if (asset.name === "Fox.gltf") {
                // Focus camera on loaded model
                const bbox = calcEntityAABB(new pc.BoundingBox(), entity);
                this.cameraScript.refocus(bbox.center, null, null, true);
                this.play("Run");
            }
        }
    }
}

// Initialize viewer
window.addEventListener('DOMContentLoaded', () => {
    new Viewer(document.getElementById("application"));
});