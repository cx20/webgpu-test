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
const CAM_RADIUS = Math.sqrt(250);
const CAM_BETA = Math.acos(5 / CAM_RADIUS);

// Quaternion for 90 degree rotation around Y axis
const Q_Y90 = { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) };

// Fox.gltf has no `indices` field (non-indexed geometry).
// Babylon.js Lite only supports drawIndexed(), so we patch the GLTF at runtime
// to add sequential indices [0, 1, 2, ..., N-1] and return a Blob URL.
async function patchGltfAddIndices(gltfUrl) {
    const baseUrl = gltfUrl.substring(0, gltfUrl.lastIndexOf("/") + 1);
    const json = await fetch(gltfUrl).then(r => r.json());
    const prim = json.meshes[0].primitives[0];
    if (prim.indices != null) return gltfUrl;

    const makeAbsolute = uri =>
        (uri && !uri.startsWith("data:") && !uri.match(/^https?:\/\//) ? baseUrl + uri : uri);
    for (const buf of json.buffers ?? []) { if (buf.uri) buf.uri = makeAbsolute(buf.uri); }
    for (const img of json.images ?? []) { if (img.uri) img.uri = makeAbsolute(img.uri); }

    const vertexCount = json.accessors[prim.attributes.POSITION].count;
    const indices = new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;

    const bytes = new Uint8Array(indices.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);

    const bufIdx = json.buffers.length;
    json.buffers.push({ uri: "data:application/octet-stream;base64," + btoa(binary), byteLength: indices.byteLength });
    const bvIdx = json.bufferViews.length;
    json.bufferViews.push({ buffer: bufIdx, byteOffset: 0, byteLength: indices.byteLength });
    const accIdx = json.accessors.length;
    json.accessors.push({ bufferView: bvIdx, componentType: 5123, count: vertexCount, type: "SCALAR" });
    prim.indices = accIdx;

    const blob = new Blob([JSON.stringify(json)], { type: "model/gltf+json" });
    return URL.createObjectURL(blob);
}

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    const cam = createArcRotateCamera(Math.PI / 2, CAM_BETA, CAM_RADIUS, { x: 0, y: 0, z: 0 });
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    const foxGltfUrl = await patchGltfAddIndices(
        "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"
    );

    const [truckAsset, foxAsset, trexAsset] = await Promise.all([
        loadGltf(engine, "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"),
        loadGltf(engine, foxGltfUrl),
        loadGltf(engine, "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"),
    ]);

    URL.revokeObjectURL(foxGltfUrl);

    // Quick Fox sanity check
    const foxMesh = foxAsset.entities[0]?.children?.[1]?.children?.[0];
    console.log("[Fox] mesh indexCount:", foxMesh?._gpu?.indexCount, "material:", !!foxMesh?.material);

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
    // Stop ALL animations to test bind pose visibility
    for (const ag of foxAsset.animationGroups ?? []) stopAnimation(ag);
    console.log("[Fox] all animations stopped. animationGroups:",
        foxAsset.animationGroups?.map(ag => `${ag.name} stopped=${ag._stopped}`));

    // Log Fox mesh world matrix after first render to confirm world position
    let foxFrameCount = 0;
    const foxMeshNode = foxAsset.entities[0]?.children?.[1]?.children?.[0];
    onBeforeRender(scene, () => {
        if (foxFrameCount++ === 2 && foxMeshNode) {
            const wm = foxMeshNode.worldMatrix;
            console.log("[Fox] worldMatrix after 2 frames:", wm ? Array.from(wm).map(v => v.toFixed(3)).join(",") : "(none)");
            console.log("[Fox] foxRoot.position:", foxRoot.position, "scaling:", foxRoot.scaling);
        }
    });

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

    console.log("[scene] renderables:", scene._renderables?.length);

    await startEngine(engine);
}

init().catch((error) => { console.error(error); });
