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
} from "https://esm.sh/@babylonjs/lite@1.0.1";

const ENV_URL = "https://assets.babylonjs.com/core/environments/environmentSpecular.env";
const BRDF_URL = "https://raw.githubusercontent.com/BabylonJS/Babylon-Lite/master/lab/public/brdf-lut.png";

// Match Babylon.js: camera.setPosition(new BABYLON.Vector3(0, 5, 15))
// ArcRotateCamera formula: x=r*cos(a)*sin(b), y=r*cos(b), z=r*sin(a)*sin(b)
// → alpha=PI/2, beta=acos(5/sqrt(250)), radius=sqrt(250)
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

    // AssetContainer root is entities[0]: a TransformNode with scaling (-1,1,1)
    // Preserve the -1 x-scale when applying model scale: set(-scale, scale, scale)

    // CesiumMilkTruck
    const truckRoot = truckAsset.entities[0];
    truckRoot.scaling.set(-0.4, 0.4, 0.4);
    truckRoot.rotationQuaternion.set(Q_Y90.x, Q_Y90.y, Q_Y90.z, Q_Y90.w);
    truckRoot.position.set(0, 0, 2);
    addToScene(scene, truckAsset);

    // Wheel tracks: two thin planes in the XZ plane (rotated from XY)
    // Matching Babylon.js: CreatePlane({width:100, height:0.1}), rotated PI/2 around X
    // z=1.6 (right track), z=2.35 (left track), centered behind the truck at x=-49.5
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

    // Fox (GLtF animations: Survey[0], Walk[1], Run[2])
    // addToScene auto-registers and plays all animation groups;
    // stop Survey and Walk so only Run plays (matches Babylon.js animationGroups[2].play(true))
    const foxRoot = foxAsset.entities[0];
    foxRoot.scaling.set(-0.05, 0.05, 0.05);
    foxRoot.rotationQuaternion.set(Q_Y90.x, Q_Y90.y, Q_Y90.z, Q_Y90.w);
    foxRoot.position.set(0, 0, 0);
    addToScene(scene, foxAsset);
    if (foxAsset.animationGroups?.length >= 3) {
        stopAnimation(foxAsset.animationGroups[0]); // Survey
        stopAnimation(foxAsset.animationGroups[1]); // Walk
    }

    // T-Rex
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

    // IBL environment for PBR materials (Fox, T-Rex use PBR from GLtF)
    // Skybox is handled separately by loadSkybox below
    await loadEnvironment(scene, ENV_URL, {
        skipSkybox: true,
        skipGround: true,
        brdfUrl: BRDF_URL,
    });

    // Skybox: playground URL uses _px/_nx naming convention that loadSkybox expects
    await loadSkybox(scene, "https://playground.babylonjs.com/textures/skybox", ".jpg");

    onBeforeRender(scene, () => {
        cam.alpha -= 0.005;
    });

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
