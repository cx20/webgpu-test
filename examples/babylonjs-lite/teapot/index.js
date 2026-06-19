import {
    addToScene,
    createDirectionalLight,
    createEngine,
    createFreeCamera,
    createMeshFromData,
    createSceneContext,
    createStandardMaterial,
    loadTexture2D,
    onBeforeRender,
    registerScene,
    startEngine,
} from "https://esm.sh/@babylonjs/lite@1.2.0";

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    scene.clearColor = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
    scene.camera = createFreeCamera({ x: 0, y: 0, z: -50 }, { x: 0, y: 0, z: 0 });

    const light = createDirectionalLight([1.0, 0.0, 1.0]);
    addToScene(scene, light);

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
    const response = await fetch("../../../assets/json/teapot.json");
    const data = await response.json();
    const positions = new Float32Array(data.vertexPositions);
    const normals = new Float32Array(data.vertexNormals);
    const uvs = new Float32Array(data.vertexTextureCoords);
    const indices = new Uint32Array(data.indices);

    const teapot = createMeshFromData(engine, "teapot", positions, normals, indices, uvs);

    const material = createStandardMaterial();
    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
    material.diffuseTexture = await loadTexture2D(engine, "../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg");
    material.backFaceCulling = false;
    teapot.material = material;
    addToScene(scene, teapot);

    onBeforeRender(scene, () => {
        teapot.rotation.y -= Math.PI / 180;
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
