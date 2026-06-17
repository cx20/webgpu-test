import {
    addToScene,
    attachControl,
    createArcRotateCamera,
    createEngine,
    createFreeCamera,
    createSceneContext,
    loadGltf,
    registerScene,
    startEngine,
} from "https://esm.sh/@babylonjs/lite@1.0.1";

// Patch non-indexed GLtF to add sequential indices as a data URI buffer
async function patchGltfAddIndices(gltfUrl) {
    const baseUrl = gltfUrl.substring(0, gltfUrl.lastIndexOf("/") + 1);
    const json = await fetch(gltfUrl).then(r => r.json());
    const prim = json.meshes[0].primitives[0];

    console.log(`[patch] ${gltfUrl}`);
    console.log(`  indices before: ${prim.indices ?? "MISSING (non-indexed)"}`);
    console.log(`  mode: ${prim.mode ?? 4} (4=TRIANGLES)`);

    if (prim.indices != null) {
        const acc = json.accessors[prim.indices];
        console.log(`  already indexed: count=${acc.count} componentType=${acc.componentType}`);
        return gltfUrl; // already indexed, no patch needed
    }

    const makeAbsolute = uri => (uri && !uri.startsWith("data:") && !uri.match(/^https?:\/\//) ? baseUrl + uri : uri);
    for (const buf of json.buffers ?? []) { if (buf.uri) buf.uri = makeAbsolute(buf.uri); }
    for (const img of json.images ?? []) { if (img.uri) img.uri = makeAbsolute(img.uri); }

    const vertexCount = json.accessors[prim.attributes.POSITION].count;
    console.log(`  vertexCount: ${vertexCount} → adding indices [0..${vertexCount-1}]`);

    const indices = new Uint16Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indices[i] = i;

    const bytes = new Uint8Array(indices.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const dataUri = "data:application/octet-stream;base64," + btoa(binary);

    const bufIdx = json.buffers.length;
    json.buffers.push({ uri: dataUri, byteLength: indices.byteLength });
    const bvIdx = json.bufferViews.length;
    json.bufferViews.push({ buffer: bufIdx, byteOffset: 0, byteLength: indices.byteLength });
    const accIdx = json.accessors.length;
    json.accessors.push({ bufferView: bvIdx, componentType: 5123, count: vertexCount, type: "SCALAR" });

    prim.indices = accIdx;
    console.log(`  patch applied: new accessor[${accIdx}] indexCount=${vertexCount}`);

    const blob = new Blob([JSON.stringify(json)], { type: "model/gltf+json" });
    return URL.createObjectURL(blob);
}

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    // Use a simple free camera looking at the origin
    scene.camera = createFreeCamera({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: 0 });

    // Test 1: Triangle (indexed - should work natively)
    const triangleUrl = "https://cx20.github.io/gltf-test/tutorialModels/Triangle/glTF/Triangle.gltf";
    // Test 2: TriangleWithoutIndices (non-indexed - requires patch)
    const triangleNoIdxUrl = await patchGltfAddIndices(
        "https://cx20.github.io/gltf-test/tutorialModels/TriangleWithoutIndices/glTF/TriangleWithoutIndices.gltf"
    );

    console.log("[test] loading Triangle (indexed)...");
    const triangleAsset = await loadGltf(engine, triangleUrl).catch(e => { console.error("[Triangle] load error:", e); return null; });
    console.log("[test] loading TriangleWithoutIndices (patched)...");
    const triangleNoIdxAsset = await loadGltf(engine, triangleNoIdxUrl).catch(e => { console.error("[TriangleNoIdx] load error:", e); return null; });

    URL.revokeObjectURL(triangleNoIdxUrl);

    if (triangleAsset) {
        const root = triangleAsset.entities[0];
        root.position.set(-1.5, 0, 0);
        addToScene(scene, triangleAsset);
        console.log("[Triangle] added to scene. entities:", triangleAsset.entities.length);
        // Log mesh
        triangleAsset.entities[0].children?.forEach(c => {
            console.log(`  child: "${c.name}" _gpu=${!!c._gpu} indexCount=${c._gpu?.indexCount}`);
            c.children?.forEach(gc => console.log(`    grandchild: "${gc.name}" _gpu=${!!gc._gpu} indexCount=${gc._gpu?.indexCount}`));
        });
    }
    if (triangleNoIdxAsset) {
        const root = triangleNoIdxAsset.entities[0];
        root.position.set(1.5, 0, 0);
        addToScene(scene, triangleNoIdxAsset);
        console.log("[TriangleNoIdx] added to scene. entities:", triangleNoIdxAsset.entities.length);
        triangleNoIdxAsset.entities[0].children?.forEach(c => {
            console.log(`  child: "${c.name}" _gpu=${!!c._gpu} indexCount=${c._gpu?.indexCount}`);
            c.children?.forEach(gc => console.log(`    grandchild: "${gc.name}" _gpu=${!!gc._gpu} indexCount=${gc._gpu?.indexCount}`));
        });
    }

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
