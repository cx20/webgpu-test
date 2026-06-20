import {
    addToScene,
    createEngine,
    createFreeCamera,
    createMeshFromData,
    createSceneContext,
    createShaderMaterial,
    onBeforeRender,
    registerScene,
    startEngine,
} from "https://esm.sh/@babylonjs/lite@1.2.0";

const vertexSource = `struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@vertex fn mainVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = shaderSystem.worldViewProjection * vec4<f32>(input.position, 1.0);
  output.color = input.color;
  return output;
}`;

const fragmentSource = `struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

@fragment fn mainFragment(input: VertexOutput) -> @location(0) vec4<f32> {
  return input.color;
}`;

// 24 vertices (4 per face) with per-face colors
const positions = new Float32Array([
    // Front face (z=+0.5)
    -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
    // Back face (z=-0.5)
     0.5, -0.5, -0.5,  -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
    // Top face (y=+0.5)
    -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,  -0.5,  0.5, -0.5,
    // Bottom face (y=-0.5)
    -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
    // Right face (x=+0.5)
     0.5, -0.5,  0.5,   0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
    // Left face (x=-0.5)
    -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
]);

const normals = new Float32Array([
     0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,  // Front
     0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,  // Back
     0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,  // Top
     0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,  // Bottom
     1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,  // Right
    -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  // Left
]);

const indices = new Uint32Array([
     0,  1,  2,   0,  2,  3,  // Front
     4,  5,  6,   4,  6,  7,  // Back
     8,  9, 10,   8, 10, 11,  // Top
    12, 13, 14,  12, 14, 15,  // Bottom
    16, 17, 18,  16, 18, 19,  // Right
    20, 21, 22,  20, 22, 23,  // Left
]);

const colors = new Float32Array([
    1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  1.0, 0.0, 0.0, 1.0,  // Front: Red
    1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  1.0, 1.0, 0.0, 1.0,  // Back: Yellow
    0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  0.0, 1.0, 0.0, 1.0,  // Top: Green
    1.0, 0.5, 0.5, 1.0,  1.0, 0.5, 0.5, 1.0,  1.0, 0.5, 0.5, 1.0,  1.0, 0.5, 0.5, 1.0,  // Bottom: Pink
    1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  1.0, 0.0, 1.0, 1.0,  // Right: Magenta
    0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  0.0, 0.0, 1.0, 1.0,  // Left: Blue
]);

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    scene.clearColor = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
    scene.camera = createFreeCamera({ x: 0, y: 0, z: -3 }, { x: 0, y: 0, z: 0 });

    const material = createShaderMaterial({
        name: "cubeMaterial",
        vertexSource,
        fragmentSource,
        attributes: ["position", "color"],
        uniforms: ["worldViewProjection"],
        backFaceCulling: false,
    });

    const cube = createMeshFromData(
        engine,
        "cube",
        positions,
        normals,
        indices,
        undefined,
        undefined,
        undefined,
        colors,
    );
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
