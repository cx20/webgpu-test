import {
    addToScene,
    createBox,
    createEngine,
    createFreeCamera,
    createSceneContext,
    createStandardMaterial,
    loadTexture2D,
    onBeforeRender,
    registerScene,
    startEngine,
} from "@babylonjs/lite";

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    scene.clearColor = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
    scene.camera = createFreeCamera({ x: 0, y: 0, z: -3 }, { x: 0, y: 0, z: 0 });

    const cube = createBox(engine, 1.0);
    const material = createStandardMaterial();
    material.diffuseTexture = await loadTexture2D(engine, "../../../assets/textures/frog.jpg");
    material.emissiveColor = [1, 1, 1];
    cube.material = material;
    addToScene(scene, cube);

    onBeforeRender(scene, () => {
        cube.rotation.x += Math.PI / 180;
        cube.rotation.y += Math.PI / 180;
        cube.rotation.z += Math.PI / 180;
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
