async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -2.4), scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);
        const square = new BABYLON.Mesh.CreatePlane('square', 1.0, scene);
        const colors = [
            0.0, 0.0, 1.0, 1.0,
            1.0, 1.0, 0.0, 1.0,
            0.0, 1.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0
        ];
        square.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
        square.material = new BABYLON.StandardMaterial("material", scene);
        square.material.emissiveColor = new BABYLON.Color3(1, 1, 1);

        return scene;
    }

    const scene = createScene(engine);

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener('resize', function(){
        engine.resize();
    });
}

init();
