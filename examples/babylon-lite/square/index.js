import {
    addToScene,
    createEngine,
    createFreeCamera,
    createMeshFromData,
    createSceneContext,
    createShaderMaterial,
    registerScene,
    startEngine,
} from "@babylonjs/lite";

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

const positions = new Float32Array([
    -0.5, -0.5, 0.0,
     0.5, -0.5, 0.0,
     0.5,  0.5, 0.0,
    -0.5,  0.5, 0.0,
]);

const normals = new Float32Array([
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
]);

const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

const colors = new Float32Array([
    0.0, 0.0, 1.0, 1.0,
    1.0, 1.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,
]);

async function init() {
    const canvas = document.querySelector("#c");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    scene.clearColor = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
    scene.camera = createFreeCamera({ x: 0, y: 0, z: -2.4 }, { x: 0, y: 0, z: 0 });

    const material = createShaderMaterial({
        name: "squareMaterial",
        vertexSource,
        fragmentSource,
        attributes: ["position", "color"],
        uniforms: ["worldViewProjection"],
        backFaceCulling: false,
    });

    const square = createMeshFromData(
        engine,
        "square",
        positions,
        normals,
        indices,
        undefined,
        undefined,
        undefined,
        colors,
    );
    square.material = material;
    addToScene(scene, square);

    await registerScene(scene);
    await startEngine(engine);
}

init().catch((error) => {
    console.error(error);
});
