async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();
    
    const createScene = function(engine) {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -5), scene);
        const square = new BABYLON.Mesh('square', scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);

        // Square data
        //             1.0 y 
        //              ^  -1.0 
        //              | / z
        //              |/       x
        // -1.0 -----------------> +1.0
        //            / |
        //      +1.0 /  |
        //           -1.0
        // 
        //        [0]------[1]
        //         |      / |
        //         |    /   |
        //         |  /     |
        //        [2]------[3]
        //
        const positions = [
            -0.5, 0.5, 0.0, // v0
             0.5, 0.5, 0.0, // v1 
            -0.5,-0.5, 0.0, // v2
             0.5,-0.5, 0.0  // v3
        ];
        const colors = [
            1.0, 0.0, 0.0, 1.0, // v0
            0.0, 1.0, 0.0, 1.0, // v1
            0.0, 0.0, 1.0, 1.0, // v2
            1.0, 1.0, 0.0, 1.0  // v3
        ];
        const indices = [
            2, 0, 1, // v2-v0-v1
            2, 1, 3  // v2-v1-v3
        ];

        square.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
        square.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
        square.setIndices(indices);

        const material = new BABYLON.ShaderMaterial("material", scene, {
            vertexElement: "vs",
            fragmentElement: "fs",
        }, {
            attributes: ["position", "color"],
            shaderLanguage: BABYLON.ShaderLanguage.WGSL
        });

        square.material = material;
        square.material.backFaceCulling = false;

        return scene;
    }

    const scene = createScene();

    engine.runRenderLoop(() => {
        scene.render();
    });


}

init();
