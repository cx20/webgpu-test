import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

// Animated glTF models, placed in a row, each playing its own animation.
const modelInfoSet = [
    {
        name: "CesiumMilkTruck",
        scale: 0.4,
        position: [0, -2, -2],
        url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf",
        animation: "all",
    },
    {
        name: "Fox",
        scale: 0.05,
        position: [0, -2, 0],
        url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf",
        animation: 2, // 0:Survey, 1:Walk, 2:Run
    },
    {
        name: "Rex",
        scale: 1.0,
        position: [0, -2, 3],
        url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf",
        animation: "all",
    },
];

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.OrbitController(redGPUContext);
        controller.distance = 10;
        controller.tilt = -11;

        const scene = new RedGPU.Display.Scene();
        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        // Skybox background (6-image cube texture). The same three.js sample skybox
        // is reused here (served with CORS headers from raw.githubusercontent.com).
        const skyboxPath = "https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/";
        const cubeTexture = new RedGPU.Resource.CubeTexture(redGPUContext, [
            skyboxPath + "px.jpg", skyboxPath + "nx.jpg",
            skyboxPath + "py.jpg", skyboxPath + "ny.jpg",
            skyboxPath + "pz.jpg", skyboxPath + "nz.jpg",
        ]);
        view.skybox = new RedGPU.Display.SkyBox(redGPUContext, cubeTexture);

        // Lights so the PBR glTF models are visible (no IBL is used here).
        const keyLight = new RedGPU.Light.DirectionalLight([-1, -1, -1]);
        const fillLight = new RedGPU.Light.DirectionalLight([1, -0.5, 1]);
        scene.lightManager.addDirectionalLight(keyLight);
        scene.lightManager.addDirectionalLight(fillLight);

        // Wheel tracks (ruts) under the truck: two thin horizontal strips along X.
        // Ground lies on the XZ plane (normal +Y), which is what we want here. Their
        // Z is finalised once we know the truck's real position (see the render loop).
        const trackMaterial = new RedGPU.Material.ColorMaterial(redGPUContext, '#c5866f');
        const tracks = [-1.6, -2.35].map((z) => {
            const track = new RedGPU.Display.Mesh(
                redGPUContext,
                new RedGPU.Primitive.Ground(redGPUContext, 100, 0.1),
                trackMaterial
            );
            track.setPosition(-49.5, -2, z);
            scene.addChild(track);
            return track;
        });

        // Sand dust kicked up by the truck's tyres. The truck's model origin is
        // offset from its body, so instead of guessing we spawn the dust once the
        // truck is loaded, at its real (rendered) bounding-box position.
        const dustTexture = new RedGPU.Resource.BitmapTexture(redGPUContext, '../../../assets/textures/smokeparticle.png');
        const createDustEmitter = (x, y, z) => {
            const dust = new RedGPU.Display.ParticleEmitter(redGPUContext);
            dust.material.diffuseTexture = dustTexture;
            dust.useBillboard = true;
            dust.particleNum = 200;
            dust.minLife = 600;
            dust.maxLife = 1500;
            // start: tight cluster at the tyre, near the ground
            dust.minStartX = -0.2; dust.maxStartX = 0.2;
            dust.minStartY = 0.0;  dust.maxStartY = 0.1;
            dust.minStartZ = -0.2; dust.maxStartZ = 0.2;
            // end: drift up and spread out
            dust.minEndX = -0.6; dust.maxEndX = 0.6;
            dust.minEndY = 0.5;  dust.maxEndY = 1.3;
            dust.minEndZ = -0.4; dust.maxEndZ = 0.4;
            // scale: small -> large (dust puff expands)
            dust.minStartScale = 0.1; dust.maxStartScale = 0.3;
            dust.minEndScale = 0.6;   dust.maxEndScale = 1.0;
            // alpha: faint -> fully transparent
            dust.minStartAlpha = 0.4; dust.maxStartAlpha = 0.7;
            dust.minEndAlpha = 0.0;   dust.maxEndAlpha = 0.0;
            dust.setPosition(x, y, z);
            scene.addChild(dust);
        };

        let truckMesh = null;

        for (const m of modelInfoSet) {
            new RedGPU.GLTFLoader(redGPUContext, m.url, (result) => {
                const mesh = result.resultMesh;
                mesh.setScale(m.scale, m.scale, m.scale);
                mesh.setPosition(m.position[0], m.position[1], m.position[2]);
                mesh.rotationY = 90; // three.js used rotation.y = Math.PI / 2
                if (m.name === "CesiumMilkTruck") truckMesh = mesh;

                // RedGPU's GLTFLoader auto-plays ALL clips after parsing. For the Fox
                // that means Survey + Walk + Run play at once and fight each other, so
                // stop everything first and play only the requested clip.
                const animations = result.parsingResult.animations || [];
                result.stopAnimation();
                if (animations.length) {
                    if (m.animation === "all") {
                        animations.forEach((clip) => result.playAnimation(clip));
                    } else {
                        const clip = animations.find((a) => a.name === "Run")
                            || animations[Math.min(m.animation, animations.length - 1)];
                        result.playAnimation(clip);
                    }
                }

                scene.addChild(mesh);
            });
        }

        let dustSpawned = false;
        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {
            // Auto-rotate the camera around the scene (three.js used controls.autoRotate).
            controller.pan += 0.2;

            // Once the truck has been rendered (so its world AABB is valid), align the
            // wheel tracks and dust to its actual tyre positions: bottom of the box,
            // on each side.
            if (truckMesh && !dustSpawned) {
                const aabb = truckMesh.combinedBoundingAABB;
                if (aabb && Number.isFinite(aabb.centerX) && aabb.xSize > 0) {
                    const dz = aabb.zSize * 0.35;
                    tracks[0].setPosition(-49.5, -2, aabb.centerZ - dz);
                    tracks[1].setPosition(-49.5, -2, aabb.centerZ + dz);
                    createDustEmitter(aabb.centerX, aabb.minY, aabb.centerZ - dz);
                    createDustEmitter(aabb.centerX, aabb.minY, aabb.centerZ + dz);
                    dustSpawned = true;
                }
            }
        });
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
