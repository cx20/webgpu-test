async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -2.4), scene);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);
        const points = [];
        points.push( new BABYLON.Vector3( 0.0,  0.5, 0.0 ) );
        points.push( new BABYLON.Vector3(-0.5, -0.5, 0.0 ) );
        points.push( new BABYLON.Vector3( 0.5, -0.5, 0.0 ) );
        points.push( new BABYLON.Vector3( 0.0,  0.5, 0.0 ) );

        const triangle = new BABYLON.Mesh.CreateLines('triangle', points, scene);
        triangle.color = new BABYLON.Color3(0, 0, 1);

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
