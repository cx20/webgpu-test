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

// Fox.gltf has two issues for Babylon.js Lite:
// 1. No `indices` field (non-indexed geometry) — Lite always calls drawIndexed()
// 2. No NORMAL attribute — PBR shader needs normals for lighting
// We also set doubleSided=true to fix backface culling with negative-X scaling.
async function patchGltfAddIndices(gltfUrl) {
    const baseUrl = gltfUrl.substring(0, gltfUrl.lastIndexOf("/") + 1);
    const json = await fetch(gltfUrl).then(r => r.json());
    const prim = json.meshes[0].primitives[0];

    const makeAbsolute = uri =>
        (uri && !uri.startsWith("data:") && !uri.match(/^https?:\/\//) ? baseUrl + uri : uri);
    for (const buf of json.buffers ?? []) { if (buf.uri) buf.uri = makeAbsolute(buf.uri); }
    for (const img of json.images ?? []) { if (img.uri) img.uri = makeAbsolute(img.uri); }

    for (const mat of json.materials ?? []) mat.doubleSided = true;

    // TEST: Remove skinning to confirm static mesh renders correctly
    for (const node of json.nodes ?? []) { if (node.skin != null) delete node.skin; }
    if (json.skins) json.skins.length = 0;

    const toBase64 = (typedArray) => {
        const bytes = new Uint8Array(typedArray.buffer);
        let binary = "";
        const chunk = 8192;
        for (let i = 0; i < bytes.length; i += chunk)
            binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
        return btoa(binary);
    };

    const vertexCount = json.accessors[prim.attributes.POSITION].count;

    if (prim.indices == null) {
        const indices = new Uint16Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) indices[i] = i;
        const bufIdx = json.buffers.length;
        json.buffers.push({ uri: "data:application/octet-stream;base64," + toBase64(indices), byteLength: indices.byteLength });
        const bvIdx = json.bufferViews.length;
        json.bufferViews.push({ buffer: bufIdx, byteOffset: 0, byteLength: indices.byteLength });
        const accIdx = json.accessors.length;
        json.accessors.push({ bufferView: bvIdx, componentType: 5123, count: vertexCount, type: "SCALAR" });
        prim.indices = accIdx;
    }

    if (prim.attributes.NORMAL == null) {
        // Fetch position data to compute proper flat normals
        const posAcc = json.accessors[prim.attributes.POSITION];
        const posBv = json.bufferViews[posAcc.bufferView];
        const binData = await fetch(json.buffers[posBv.buffer].uri).then(r => r.arrayBuffer());
        const stride = posBv.byteStride || 12;
        const posBase = (posBv.byteOffset ?? 0) + (posAcc.byteOffset ?? 0);
        const view = new DataView(binData);
        const getPos = (i) => [
            view.getFloat32(posBase + i * stride, true),
            view.getFloat32(posBase + i * stride + 4, true),
            view.getFloat32(posBase + i * stride + 8, true),
        ];

        const normals = new Float32Array(vertexCount * 3);
        for (let tri = 0; tri < vertexCount / 3; tri++) {
            const [ax, ay, az] = getPos(tri * 3);
            const [bx, by, bz] = getPos(tri * 3 + 1);
            const [cx, cy, cz] = getPos(tri * 3 + 2);
            const dx = bx - ax, dy = by - ay, dz = bz - az;
            const ex = cx - ax, ey = cy - ay, ez = cz - az;
            let nx = dy * ez - dz * ey, ny = dz * ex - dx * ez, nz = dx * ey - dy * ex;
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 1e-10) { nx /= len; ny /= len; nz /= len; }
            for (let j = 0; j < 3; j++) {
                normals[(tri * 3 + j) * 3]     = nx;
                normals[(tri * 3 + j) * 3 + 1] = ny;
                normals[(tri * 3 + j) * 3 + 2] = nz;
            }
        }
        const normBufIdx = json.buffers.length;
        json.buffers.push({ uri: "data:application/octet-stream;base64," + toBase64(normals), byteLength: normals.byteLength });
        const normBvIdx = json.bufferViews.length;
        json.bufferViews.push({ buffer: normBufIdx, byteOffset: 0, byteLength: normals.byteLength });
        const normAccIdx = json.accessors.length;
        json.accessors.push({ bufferView: normBvIdx, componentType: 5126, count: vertexCount, type: "VEC3" });
        prim.attributes.NORMAL = normAccIdx;
        console.log("[Fox patch] Added synthetic flat normals, vertexCount:", vertexCount);
    }

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

    const foxMesh = foxAsset.entities[0]?.children?.[1]?.children?.[0];
    console.log("[Fox] mesh indexCount:", foxMesh?._gpu?.indexCount,
        "hasNormal:", !!(foxMesh?._gpu?.normalBuffer),
        "hasSkeleton:", !!(foxMesh?._gpu?.skeleton ?? foxMesh?.skeleton),
        "material:", !!foxMesh?.material);

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
        // animationGroups[2] = Run — keep playing
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

    console.log("[scene] renderables:", scene._renderables?.length);

    await startEngine(engine);
}

init().catch((error) => { console.error(error); });
