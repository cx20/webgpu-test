async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -3), scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);
        const cube = new BABYLON.Mesh.CreateBox('cube', 1.0, scene);
        const material = new BABYLON.StandardMaterial("material", scene);
        material.diffuseTexture = new BABYLON.Texture("../../../assets/textures/frog.jpg", scene);
        material.emissiveColor = new BABYLON.Color3(1, 1, 1);
        cube.material = material;

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
