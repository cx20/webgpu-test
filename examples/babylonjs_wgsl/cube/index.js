async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();
    
    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -3), scene);
        const cube = new BABYLON.Mesh('cube', scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);

        // Cube data
        //             1.0 y 
        //              ^  -1.0 
        //              | / z
        //              |/       x
        // -1.0 -----------------> +1.0
        //            / |
        //      +1.0 /  |
        //           -1.0
        // 
        //         [7]------[6]
        //        / |      / |
        //      [3]------[2] |
        //       |  |     |  |
        //       | [4]----|-[5]
        //       |/       |/
        //      [0]------[1]
        //
        const positions = [
            // Front face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            // Back face
            -0.5, -0.5, -0.5, // v4
             0.5, -0.5, -0.5, // v5
             0.5,  0.5, -0.5, // v6
            -0.5,  0.5, -0.5, // v7
            // Top face
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
             0.5,  0.5, -0.5, // v6
            // Bottom face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5, -0.5, -0.5, // v5
            -0.5, -0.5, -0.5, // v4
            // Right face
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
             0.5,  0.5, -0.5, // v6
             0.5, -0.5, -0.5, // v5
            // Left face
            -0.5, -0.5,  0.5, // v0
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
            -0.5, -0.5, -0.5  // v4
        ];
        const colors = [
            1.0, 0.0, 0.0, 1.0, // Front face
            1.0, 0.0, 0.0, 1.0, // Front face
            1.0, 0.0, 0.0, 1.0, // Front face
            1.0, 0.0, 0.0, 1.0, // Front face
            1.0, 1.0, 0.0, 1.0, // Back face
            1.0, 1.0, 0.0, 1.0, // Back face
            1.0, 1.0, 0.0, 1.0, // Back face
            1.0, 1.0, 0.0, 1.0, // Back face
            0.0, 1.0, 0.0, 1.0, // Top face
            0.0, 1.0, 0.0, 1.0, // Top face
            0.0, 1.0, 0.0, 1.0, // Top face
            0.0, 1.0, 0.0, 1.0, // Top face
            1.0, 0.5, 0.5, 1.0, // Bottom face
            1.0, 0.5, 0.5, 1.0, // Bottom face
            1.0, 0.5, 0.5, 1.0, // Bottom face
            1.0, 0.5, 0.5, 1.0, // Bottom face
            1.0, 0.0, 1.0, 1.0, // Right face
            1.0, 0.0, 1.0, 1.0, // Right face
            1.0, 0.0, 1.0, 1.0, // Right face
            1.0, 0.0, 1.0, 1.0, // Right face
            0.0, 0.0, 1.0, 1.0, // Left face
            0.0, 0.0, 1.0, 1.0, // Left face
            0.0, 0.0, 1.0, 1.0, // Left face
            0.0, 0.0, 1.0, 1.0  // Left face
        ];
        const indices = [
            0,  1,  2,    0,  2 , 3,  // Front face
            4,  5,  6,    4,  6 , 7,  // Back face
            8,  9, 10,    8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15,  // Bottom face
            16, 17, 18,   16, 18, 19,  // Right face
            20, 21, 22,   20, 22, 23   // Left face
        ];

        cube.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
        cube.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
        cube.setIndices(indices);

        const material = new BABYLON.ShaderMaterial("material", scene, {
            vertexElement: "vs",
            fragmentElement: "fs",
        }, {
            // The position and color attributes are handled automatically by the system and do not need to be specified.
            // see: https://forum.babylonjs.com/t/how-to-display-triangles-with-webgpu-wgsl/37427/4
            //attributes: ["position", "color"],
            uniformBuffers: ["Scene", "Mesh"],
            shaderLanguage: BABYLON.ShaderLanguage.WGSL
        });

        cube.material = material;
        cube.material.backFaceCulling = false;

        scene.onBeforeRenderObservable.add(() => {
            cube.rotate(BABYLON.Axis.X, Math.PI * 1.0 / 180.0 * scene.getAnimationRatio(), BABYLON.Space.LOCAL);
            cube.rotate(BABYLON.Axis.Y, Math.PI * 1.0 / 180.0 * scene.getAnimationRatio(), BABYLON.Space.LOCAL);
            cube.rotate(BABYLON.Axis.Z, Math.PI * 1.0 / 180.0 * scene.getAnimationRatio(), BABYLON.Space.LOCAL);
        });

        return scene;
    }

    const scene = createScene();

    engine.runRenderLoop(() => {
        scene.render();
    });

}

init();

