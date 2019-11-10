var createScene = function(engine) {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -2.4), scene);
    scene.clearColor = new BABYLON.Color3(1, 1, 1);
    var points = [];
    points.push( new BABYLON.Vector3( 0.0,  0.5, 0.0 ) );
    points.push( new BABYLON.Vector3(-0.5, -0.5, 0.0 ) );
    points.push( new BABYLON.Vector3( 0.5, -0.5, 0.0 ) );
    points.push( new BABYLON.Vector3( 0.0,  0.5, 0.0 ) );

    var triangle = new BABYLON.Mesh.CreateLines('triangle', points, scene);
    triangle.color = new BABYLON.Color3(0, 0, 1);

    return scene;
}

async function init() {
    try {
        var canvas = document.querySelector("#renderCanvas");
        var engine = new BABYLON.WebGPUEngine(canvas);
        await engine.initAsync();
        var scene = createScene(engine);

        engine.runRenderLoop(function () {
            scene.render();
        });

        window.addEventListener('resize', function(){
            engine.resize();
        });
    }
    catch (e) {
        console.error(e);
    }
}

init();
