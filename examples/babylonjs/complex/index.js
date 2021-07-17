async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();

    engine.enableOfflineSupport = false; // Suppress manifest reference

    const createScene = function() {

        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color3(1, 1, 1);

        const meshes = [];

        Promise.all([
            BABYLON.SceneLoader.ImportMeshAsync(null, "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/", "CesiumMilkTruck.gltf", scene).then(function(result) {
                const scale = 0.4;
                const mesh = result.meshes[0];
                const modelScaling = mesh.scaling;
                mesh.scaling = new BABYLON.Vector3(modelScaling.x * scale, modelScaling.y * scale, modelScaling.z * scale);
                mesh.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.LOCAL);
                mesh.position = new BABYLON.Vector3(0, 0, 2);
                meshes.push(mesh);
            }),
            BABYLON.SceneLoader.ImportMeshAsync(null, "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/", "Fox.gltf", scene).then(function(result) {
                const scale = 0.05;
                const mesh = result.meshes[0];
                const modelScaling = mesh.scaling;
                mesh.scaling = new BABYLON.Vector3(modelScaling.x * scale, modelScaling.y * scale, modelScaling.z * scale);
                mesh.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.LOCAL);
                mesh.position = new BABYLON.Vector3(0, 0, 0);
                result.animationGroups[2].play(true);
                meshes.push(mesh);
            }),
            //BABYLON.SceneLoader.ImportMeshAsync(null, "https://rawcdn.githack.com/BabylonJS/Exporters/9bc140006be149687be045f60b4a25cdb45ce4fc/Maya/Samples/glTF 2.0/T-Rex/", "trex_running.gltf", scene).then(function(result) {
            BABYLON.SceneLoader.ImportMeshAsync(null, "https://rawcdn.githack.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/", "trex.gltf", scene).then(function(result) {
                const scale = 1.0;
                const mesh = result.meshes[0];
                const modelScaling = mesh.scaling;
                mesh.scaling = new BABYLON.Vector3(modelScaling.x * scale, modelScaling.y * scale, modelScaling.z * scale);
                mesh.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.LOCAL);
                mesh.position = new BABYLON.Vector3(0, 0, -3);
                meshes.push(mesh);
            })
        ]).then(() => {
            const camera = new BABYLON.ArcRotateCamera("camera", 0, 0, 0, BABYLON.Vector3.Zero(), scene);
            camera.setPosition(new BABYLON.Vector3(0, 5, 15));
            camera.attachControl(canvas, false, false);
            scene.activeCamera = camera;
            let light0 = new BABYLON.HemisphericLight("light0", new BABYLON.Vector3(1, 1, 0), scene); 
            let light1 = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(0.0, -1.0, 0.5), scene);
            let light2 = new BABYLON.DirectionalLight("dir02", new BABYLON.Vector3(-0.5, -0.5, -0.5), scene);

            // Skybox
            const cubeTexture = new BABYLON.CubeTexture(
                //"https://rawcdn.githack.com/cx20/gltf-test/c479d543/textures/cube/skybox/", // "../../textures/cube/skybox/",
                "https://rawcdn.githack.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/",
                scene,
                ["px.jpg", "py.jpg", "pz.jpg", "nx.jpg", "ny.jpg", "nz.jpg"]
            );
/*        
            scene.createDefaultSkybox(cubeTexture, true, 10000);
*/
            // If you care about the performance of createDefaultSkybox(), The following code can be used to avoid this. However, the environmental texture will not be applied.
            // http://www.html5gamedevs.com/topic/36997-using-skybox-takes-time-to-display-is-it-a-usage-problem/?tab=comments#comment-211765
            let skybox = BABYLON.Mesh.CreateBox("skyBox", 10000, scene);
            let skyboxMaterial = new BABYLON.StandardMaterial("skyBoxMaterial", scene);
            skyboxMaterial.backFaceCulling = false;
            skyboxMaterial.reflectionTexture = cubeTexture;
            skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
            skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
            skyboxMaterial.disableLighting = true;
            skybox.material = skyboxMaterial;

            const ground1 = BABYLON.MeshBuilder.CreatePlane("ground2", {width:100, height:0.1}, scene);
            ground1.rotate(BABYLON.Axis.X, Math.PI/2, BABYLON.Space.LOCAL);
            ground1.position.x = -49.5;
            ground1.position.z = 1.6;
            
            const ground2 = BABYLON.MeshBuilder.CreatePlane("ground2", {width:100, height:0.1}, scene);
            ground2.rotate(BABYLON.Axis.X, Math.PI/2, BABYLON.Space.LOCAL);
            ground2.position.x = -49.5;
            ground2.position.z = 2.35;
            
            // Create a particle system
            const particle1 = new BABYLON.ParticleSystem("particle1", 100, scene);
            
            const texture = new BABYLON.Texture("../../../assets/textures/smokeparticle.png", scene);

            //Texture of each particle
            particle1.particleTexture = texture;
            particle1.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
            particle1.minSize = 0.1;
            particle1.maxSize = 0.3;
            particle1.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
            particle1.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);
            particle1.emitRate = 100;
            particle1.colorDead = new BABYLON.Color4(1, 1, 1, 1);
            particle1.minEmitPower = 0.1;
            particle1.maxEmitPower = 0.5;
            particle1.updateSpeed = 0.05;
            
            const emitterRightBack = BABYLON.Mesh.CreateBox("emitterRightBack", 0.1, scene);
            emitterRightBack.rotate(BABYLON.Axis.Z, Math.PI*60/180, BABYLON.Space.LOCAL);
            emitterRightBack.position = new BABYLON.Vector3(-0.8, 0.1, 1.6);
            emitterRightBack.visibility = false;
            
            const emitterLeftBack = BABYLON.Mesh.CreateBox("emitterLeftBack", 0.1, scene);
            emitterLeftBack.rotate(BABYLON.Axis.Z, Math.PI*60/180, BABYLON.Space.LOCAL);
            emitterLeftBack.position = new BABYLON.Vector3(-0.8, 0.1, 2.35);
            emitterLeftBack.visibility = false;
            
            const emitterRightFront = BABYLON.Mesh.CreateBox("emitterRightFront", 0.1, scene);
            emitterRightFront.rotate(BABYLON.Axis.Z, Math.PI*60/180, BABYLON.Space.LOCAL);
            emitterRightFront.position = new BABYLON.Vector3(0.3, 0.1, 1.6);
            emitterRightFront.visibility = false;

            const emitterLeftFront = BABYLON.Mesh.CreateBox("emitterLeftFront", 0.1, scene);
            emitterLeftFront.rotate(BABYLON.Axis.Z, Math.PI*60/180, BABYLON.Space.LOCAL);
            emitterLeftFront.position = new BABYLON.Vector3(0.3, 0.1, 2.35);
            emitterLeftFront.visibility = false;

            const particleRightBack  = particle1.clone("particleRightBack",  emitterRightBack);
            const particleLeftBack   = particle1.clone("particleLeftBack",   emitterLeftBack);
            const particleRightFront = particle1.clone("particleRightFront", emitterRightFront);
            const particleLeftFront  = particle1.clone("particleLeftFront",  emitterLeftFront);
            
            particleRightFront.maxEmitPower = 0.2;
            particleLeftFront .maxEmitPower = 0.2;

            particleRightBack .start();
            particleLeftBack  .start();
            particleRightFront.start();
            particleLeftFront .start();

            engine.runRenderLoop(function() {
                scene.activeCamera.alpha -= 0.005;
                scene.render();
            });
        });
        return scene;
    }
    
    const scene = createScene();

    window.addEventListener('resize', function(){
        engine.resize();
    });
}

init();
