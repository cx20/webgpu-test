var cube;
var createScene = function(engine) {
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -3), scene);
    scene.clearColor = new BABYLON.Color3(1, 1, 1);
    cube = new BABYLON.Mesh.CreateBox('cube', 1.0, scene);
    var colors = [
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

    return scene;
}

async function init() {
    try {
        var canvas = document.querySelector("#renderCanvas");
        var engine = new BABYLON.WebGPUEngine(canvas);
        await engine.initAsync();
        var scene = createScene(engine);

        var rad = 0.0;
        engine.runRenderLoop(function () {
            rad += Math.PI * 1.0 / 180.0;
            cube.rotation.x = rad;
            cube.rotation.y = rad;
            cube.rotation.z = rad;
            scene.render();
        });

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
