async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -5), scene);
        const triangle = new BABYLON.Mesh('triangle', scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);

        const positions = [
             0.0,  0.5, 0.0, // v0
            -0.5, -0.5, 0.0, // v1
             0.5, -0.5, 0.0  // v2
        ];
        const indices = [0, 1, 2];

        triangle.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
        triangle.setIndices(indices);
    
        const material = new BABYLON.ShaderMaterial("material", scene, {
            vertexElement: "vs",
            fragmentElement: "fs",
        }, {
            attributes: ["position"],
            shaderLanguage: BABYLON.ShaderLanguage.WGSL
        });

        triangle.material = material;

        return scene;
    }

    const scene = createScene();

    engine.runRenderLoop(() => {
        scene.render();
    });

}

init();