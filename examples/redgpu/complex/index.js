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
        // Ground lies on the XZ plane (normal +Y), which is what we want here.
        const trackMaterial = new RedGPU.Material.ColorMaterial(redGPUContext, '#c5866f');
        const trackZ = [-1.6, -2.35];
        trackZ.forEach((z) => {
            const track = new RedGPU.Display.Mesh(
                redGPUContext,
                new RedGPU.Primitive.Ground(redGPUContext, 100, 0.1),
                trackMaterial
            );
            track.setPosition(-49.5, -2, z);
            scene.addChild(track);
        });

        // Sand dust kicked up by the truck's tyres. A ParticleEmitter emits particles
        // in world space using (range + currentPosition), where currentPosition is
        // localToWorld(x, y, z) of the emitter itself - i.e. setPosition is applied
        // twice (the matrix translation AND the point), doubling the location. So the
        // emitter is left at the origin and the wheel world position is baked directly
        // into the start/end ranges instead. (wx, gy, wz) = the wheel world position.
        const dustTexture = new RedGPU.Resource.BitmapTexture(redGPUContext, '../../../assets/textures/smokeparticle.png');
        const createDustEmitter = (wx, gy, wz) => {
            const dust = new RedGPU.Display.ParticleEmitter(redGPUContext);
            dust.material.diffuseTexture = dustTexture;
            dust.useBillboard = true;
            dust.particleNum = 120;
            dust.minLife = 500;
            dust.maxLife = 1100;
            // start: tight cluster right at the tyre, on the ground
            dust.minStartX = wx - 0.1; dust.maxStartX = wx + 0.1;
            dust.minStartY = gy;       dust.maxStartY = gy + 0.05;
            dust.minStartZ = wz - 0.1; dust.maxStartZ = wz + 0.1;
            // end: a small puff that stays close to the tyre
            dust.minEndX = wx - 0.25;  dust.maxEndX = wx + 0.25;
            dust.minEndY = gy + 0.15;  dust.maxEndY = gy + 0.45;
            dust.minEndZ = wz - 0.2;   dust.maxEndZ = wz + 0.2;
            // scale: small -> moderate (kept small so it doesn't cover the body)
            dust.minStartScale = 0.08; dust.maxStartScale = 0.16;
            dust.minEndScale = 0.3;    dust.maxEndScale = 0.5;
            // alpha: faint -> fully transparent
            dust.minStartAlpha = 0.4; dust.maxStartAlpha = 0.7;
            dust.minEndAlpha = 0.0;   dust.maxEndAlpha = 0.0;
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
        let truckRenderedFrames = 0;
        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {
            // Auto-rotate the camera around the scene (three.js used controls.autoRotate).
            controller.pan += 0.2;

            // Spawn the dust once the truck has actually been rendered for a few frames.
            // combinedBoundingAABB is world-space (it uses the model matrix), and that
            // matrix is only valid after the truck has been drawn at least once - reading
            // it too early returns the untransformed (local) box and a wrong centre.
            // The truck sits on z = -1.6 / -2.35 (the tracks line up), so only its X
            // needs correcting from the nominal 0 to its real world-centre X.
            if (truckMesh && !dustSpawned) {
                truckRenderedFrames++;
                if (truckRenderedFrames > 3) {
                    const aabb = truckMesh.combinedBoundingAABB;
                    if (aabb && Number.isFinite(aabb.centerX) && aabb.xSize > 0) {
                        // One emitter per wheel (front/back x left/right), mirroring the
                        // Babylon.js sample. Babylon hard-codes the 4 wheels around the
                        // wheelbase centre +/- 0.55 in X; use the truck's real world centre
                        // X (robust to the model's origin offset / rotation handedness) and
                        // its bottom (minY) as the ground, with Z on the two tracks.
                        const wheelX = [aabb.centerX - 0.55, aabb.centerX + 0.55];
                        wheelX.forEach((wx) => trackZ.forEach((wz) => createDustEmitter(wx, aabb.minY, wz)));
                        dustSpawned = true;
                    }
                }
            }
        });
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
