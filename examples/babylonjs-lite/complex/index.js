import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createDirectionalLight,
    createEngine,
    createHemisphericLight,
    createPlane,
    createSceneContext,
    createStandardMaterial,
    loadEnvironment,
    loadGltf,
    loadSkybox,
    onBeforeRender,
    registerScene,
    startEngine,
    stopAnimation,
} from "https://esm.sh/@babylonjs/lite@1.2.0";

const ENV_URL = "https://assets.babylonjs.com/core/environments/environmentSpecular.env";
const BRDF_URL = "https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/master/lab/public/brdf-lut.png";

// Match Babylon.js: camera.setPosition(new BABYLON.Vector3(0, 5, 15))
const CAM_RADIUS = Math.sqrt(250);
const CAM_BETA = Math.acos(5 / CAM_RADIUS);

// Quaternion for 90 degree rotation around Y axis
const Q_Y90 = { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) };

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    const cam = createArcRotateCamera(Math.PI / 2, CAM_BETA, CAM_RADIUS, { x: 0, y: 0, z: 0 });
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    const [truckAsset, foxAsset, trexAsset] = await Promise.all([
        loadGltf(engine, "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"),
        loadGltf(engine, "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"),
        loadGltf(engine, "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"),
    ]);

    const truckRoot = truckAsset.entities[0];
    truckRoot.scaling.set(-0.4, 0.4, 0.4);
    truckRoot.rotationQuaternion.set(Q_Y90.x, Q_Y90.y, Q_Y90.z, Q_Y90.w);
    truckRoot.position.set(0, 0, 2);
    addToScene(scene, truckAsset);

    const trackMaterial = createStandardMaterial();
    trackMaterial.diffuseColor = [0.3, 0.25, 0.2];

    const track1 = createPlane(engine, { width: 100, height: 0.1 });
    track1.rotation.x = Math.PI / 2;
    track1.position.set(-49.5, 0, 1.6);
    track1.material = trackMaterial;
    addToScene(scene, track1);

    const track2 = createPlane(engine, { width: 100, height: 0.1 });
    track2.rotation.x = Math.PI / 2;
    track2.position.set(-49.5, 0, 2.35);
    track2.material = trackMaterial;
    addToScene(scene, track2);

    const foxRoot = foxAsset.entities[0];
    foxRoot.scaling.set(-0.05, 0.05, 0.05);
    foxRoot.rotationQuaternion.set(Q_Y90.x, Q_Y90.y, Q_Y90.z, Q_Y90.w);
    foxRoot.position.set(0, 0, 0);
    addToScene(scene, foxAsset);
    if (foxAsset.animationGroups?.length >= 3) {
        stopAnimation(foxAsset.animationGroups[0]); // Survey
        stopAnimation(foxAsset.animationGroups[1]); // Walk
        // animationGroups[2] = Run
    }

    const trexRoot = trexAsset.entities[0];
    trexRoot.rotationQuaternion.set(Q_Y90.x, Q_Y90.y, Q_Y90.z, Q_Y90.w);
    trexRoot.position.set(0, 0, -3);
    addToScene(scene, trexAsset);

    const light0 = createHemisphericLight([1, 1, 0]);
    addToScene(scene, light0);
    const light1 = createDirectionalLight([0.0, -1.0, 0.5]);
    addToScene(scene, light1);
    const light2 = createDirectionalLight([-0.5, -0.5, -0.5]);
    addToScene(scene, light2);

    await loadEnvironment(scene, ENV_URL, {
        skipSkybox: true,
        skipGround: true,
        brdfUrl: BRDF_URL,
    });

    await loadSkybox(scene, "https://playground.babylonjs.com/textures/skybox", ".jpg");

    onBeforeRender(scene, () => { cam.alpha -= 0.005; });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => { console.error(error); });
