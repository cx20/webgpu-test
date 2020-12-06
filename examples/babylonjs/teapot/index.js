async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    let teapotMesh;
    let vertexPositions;
    let vertexNormals;
    let vertexTextureCoords;
    let indices;

    const createScene = function(engine) {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -50), scene);
        const light1 = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(1.0, 0.0, 1.0), scene);
        scene.clearColor = new BABYLON.Color3(0, 0, 0);
        const material = new BABYLON.StandardMaterial("material", scene);
        // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
        material.diffuseTexture = new BABYLON.Texture("../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg", scene);
        teapotMesh = new BABYLON.Mesh("teapot", scene);
        teapotMesh.material = material;
        teapotMesh.material.backFaceCulling = false;
        teapotMesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, vertexPositions, false);
        teapotMesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, vertexNormals, false);
        teapotMesh.setVerticesData(BABYLON.VertexBuffer.UVKind, vertexTextureCoords, false);
        teapotMesh.setIndices(indices);

        return scene;
    };

    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
    $.getJSON("../../../assets/json/teapot.json", function (data) {
        vertexPositions = data.vertexPositions;
        vertexTextureCoords = data.vertexTextureCoords;
        vertexNormals = data.vertexNormals;
        indices = data.indices;
        const scene = createScene(engine);

        engine.runRenderLoop(function () {
            teapotMesh.rotate(BABYLON.Axis.Y, -Math.PI * 1.0 / 180.0, BABYLON.Space.LOCAL);
            scene.render();
        });

        window.addEventListener('resize', function(){
            engine.resize();
        });
    });
}

init();
