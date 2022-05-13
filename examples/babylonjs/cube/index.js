async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -3), scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);
        const cube = new BABYLON.Mesh.CreateBox('cube', 1.0, scene);
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
        cube.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
        cube.material = new BABYLON.StandardMaterial("material", scene);
        cube.material.emissiveColor = new BABYLON.Color3(1, 1, 1);

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

    window.addEventListener('resize', function(){
        engine.resize();
    });
}

init();
