import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createDirectionalLight,
    createEngine,
    createHemisphericLight,
    createSceneContext,
    loadGltf,
    loadSkybox,
    onBeforeRender,
    playAnimation,
    registerScene,
    startEngine,
} from "https://esm.sh/@babylonjs/lite@1.0.1";

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

    // CesiumMilkTruck
    const truckRoot = truckAsset.meshes[0];
    truckRoot.scaling.set(0.4, 0.4, 0.4);
    truckRoot.rotation.y = Math.PI / 2;
    truckRoot.position.set(0, 0, 2);
    addToScene(scene, truckAsset);

    // Fox with Walk animation
    const foxRoot = foxAsset.meshes[0];
    foxRoot.scaling.set(0.05, 0.05, 0.05);
    foxRoot.rotation.y = Math.PI / 2;
    foxRoot.position.set(0, 0, 0);
    addToScene(scene, foxAsset);
    if (foxAsset.animationGroups && foxAsset.animationGroups[2]) {
        foxAsset.animationGroups[2].loopAnimation = true;
        playAnimation(foxAsset.animationGroups[2]);
    }

    // T-Rex
    const trexRoot = trexAsset.meshes[0];
    trexRoot.rotation.y = Math.PI / 2;
    trexRoot.position.set(0, 0, -3);
    addToScene(scene, trexAsset);

    const light0 = createHemisphericLight([1, 1, 0]);
    addToScene(scene, light0);

    const light1 = createDirectionalLight([0.0, -1.0, 0.5]);
    addToScene(scene, light1);

    const light2 = createDirectionalLight([-0.5, -0.5, -0.5]);
    addToScene(scene, light2);

    await loadSkybox(
        scene,
        "https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/",
        ".jpg"
    );

    onBeforeRender(scene, () => {
        cam.alpha -= 0.005;
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
