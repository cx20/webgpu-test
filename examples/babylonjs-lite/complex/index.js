import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createDirectionalLight,
    createEngine,
    createHemisphericLight,
    createSceneContext,
    loadEnvironment,
    loadGltf,
    onBeforeRender,
    playAnimation,
    registerScene,
    startEngine,
} from "https://esm.sh/@babylonjs/lite@1.0.1";

// Quaternion for 90 degree rotation around Y axis
const Q_Y90_X = 0;
const Q_Y90_Y = Math.sin(Math.PI / 4);
const Q_Y90_Z = 0;
const Q_Y90_W = Math.cos(Math.PI / 4);

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    const cam = createArcRotateCamera(0, Math.PI / 6, 16, { x: 0, y: 0, z: 0 });
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    const [truckAsset, foxAsset, trexAsset] = await Promise.all([
        loadGltf(engine, "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"),
        loadGltf(engine, "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"),
        loadGltf(engine, "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"),
    ]);

    // AssetContainer root is entities[0] (a TransformNode with scale (-1,1,1) for coord system)
    // Preserve the -1 x-scale while applying model scale

    // CesiumMilkTruck
    const truckRoot = truckAsset.entities[0];
    truckRoot.scaling.set(-0.4, 0.4, 0.4);
    truckRoot.rotationQuaternion.set(Q_Y90_X, Q_Y90_Y, Q_Y90_Z, Q_Y90_W);
    truckRoot.position.set(0, 0, 2);
    addToScene(scene, truckAsset);

    // Fox with Walk animation (animationGroups[2])
    const foxRoot = foxAsset.entities[0];
    foxRoot.scaling.set(-0.05, 0.05, 0.05);
    foxRoot.rotationQuaternion.set(Q_Y90_X, Q_Y90_Y, Q_Y90_Z, Q_Y90_W);
    foxRoot.position.set(0, 0, 0);
    addToScene(scene, foxAsset);
    if (foxAsset.animationGroups && foxAsset.animationGroups[2]) {
        foxAsset.animationGroups[2].loopAnimation = true;
        playAnimation(foxAsset.animationGroups[2]);
    }

    // T-Rex
    const trexRoot = trexAsset.entities[0];
    trexRoot.rotationQuaternion.set(Q_Y90_X, Q_Y90_Y, Q_Y90_Z, Q_Y90_W);
    trexRoot.position.set(0, 0, -3);
    addToScene(scene, trexAsset);

    const light0 = createHemisphericLight([1, 1, 0]);
    addToScene(scene, light0);

    const light1 = createDirectionalLight([0.0, -1.0, 0.5]);
    addToScene(scene, light1);

    const light2 = createDirectionalLight([-0.5, -0.5, -0.5]);
    addToScene(scene, light2);

    await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
        skyboxUrl: "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds",
        brdfUrl: "https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/master/lab/public/brdf-lut.png",
    });

    onBeforeRender(scene, () => {
        cam.alpha -= 0.005;
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
