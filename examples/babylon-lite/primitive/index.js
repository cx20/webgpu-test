import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createBox,
    createCylinder,
    createDisc,
    createEngine,
    createPlane,
    createPolyhedron,
    createSceneContext,
    createSphere,
    createStandardMaterial,
    createTorus,
    createTorusKnot,
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

    const cam = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 6, { x: 0, y: 0, z: 0 });
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    const texA = await loadTexture2D(engine, "../../../assets/textures/earth.jpg");
    const texB = await loadTexture2D(engine, "../../../assets/textures/earth_reverse_left_right_up_down.jpg");

    const materialA = createStandardMaterial();
    materialA.diffuseTexture = texA;
    materialA.emissiveColor = [1, 1, 1];

    const materialB = createStandardMaterial();
    materialB.diffuseTexture = texB;
    materialB.emissiveColor = [1, 1, 1];

    const plane = createPlane(engine, { size: 1.0 });
    plane.position.set(-1.5, 1.5, 0);
    plane.material = materialA;

    const cube = createBox(engine, 1.0);
    cube.position.set(0, 1.5, 0);
    cube.material = materialA;

    const sphere = createSphere(engine, { segments: 24, diameter: 1.0 });
    sphere.position.set(1.5, 1.5, 0);
    sphere.material = materialB;

    const circle = createDisc(engine, { radius: 0.5, tessellation: 24 });
    circle.position.set(-1.5, 0, 0);
    circle.material = materialA;

    const cylinder = createCylinder(engine, { height: 1, diameter: 1, tessellation: 32 });
    cylinder.position.set(0, 0, 0);
    cylinder.material = materialA;

    const cone = createCylinder(engine, { height: 1, diameterTop: 0, diameterBottom: 1, tessellation: 32 });
    cone.position.set(1.5, 0, 0);
    cone.material = materialA;

    const knot = createTorusKnot(engine, { radius: 0.3, tube: 0.1, radialSegments: 128, tubularSegments: 64, p: 2, q: 3 });
    knot.position.set(-1.5, -1.5, 0);
    knot.material = materialA;

    const torus = createTorus(engine, { diameter: 1.0, thickness: 0.2, tessellation: 10 });
    torus.position.set(0, -1.5, 0);
    torus.material = materialA;

    const octa = createPolyhedron(engine, { type: 1, size: 0.5 });
    octa.position.set(1.5, -1.5, 0);
    octa.material = materialA;

    const meshes = [plane, cube, sphere, circle, cylinder, cone, knot, torus, octa];
    for (const mesh of meshes) {
        addToScene(scene, mesh);
    }

    let rad = 0.0;
    onBeforeRender(scene, () => {
        rad += Math.PI / 180;
        for (const mesh of meshes) {
            mesh.rotation.y = rad;
        }
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
