import Rn from 'rhodonite';

const load = async function () {
    const c = document.getElementById('world');

    const engine = await Rn.Engine.init({
      approach: Rn.ProcessApproach.WebGPU,
      canvas: c,
    });

    resizeCanvas();
    
    window.addEventListener("resize", function(){
        resizeCanvas();
    });

    function resizeCanvas() {
        engine.resizeCanvas(window.innerWidth, window.innerHeight);
    }

	const assets = await Rn.defaultAssetLoader.load({
		texture: Rn.Texture.loadFromUrl(engine, '../../../assets/textures/earth.jpg')
	});

    const sampler = new Rn.Sampler(engine, {
      magFilter: Rn.TextureParameter.Linear,
      minFilter: Rn.TextureParameter.Linear,
      wrapS: Rn.TextureParameter.ClampToEdge,
      wrapT: Rn.TextureParameter.ClampToEdge,
    });
    sampler.create();

    const material = Rn.MaterialHelper.createClassicUberMaterial(engine);
    material.setTextureParameter('diffuseColorTexture', assets.texture, sampler);
    
    const entities = [];

    const entity1 = Rn.MeshHelper.createPlane(engine, {material: material});
    const entity2 = Rn.MeshHelper.createSphere(engine, {material: material});
    const entity3 = Rn.MeshHelper.createCube(engine, {material: material});
    const entity4 = Rn.MeshHelper.createGrid(engine);
    const entity5 = Rn.MeshHelper.createAxis(engine);
    const entity6 = Rn.MeshHelper.createJoint(engine);

    entity1.localPosition = Rn.Vector3.fromCopyArray([-3.0,  1.5, 0]);
    entity2.localPosition = Rn.Vector3.fromCopyArray([ 0.0,  1.5, 0]);
    entity3.localPosition = Rn.Vector3.fromCopyArray([ 3.0,  1.5, 0]);
    entity4.localPosition = Rn.Vector3.fromCopyArray([-3.0, -1.5, 0]);
    entity5.localPosition = Rn.Vector3.fromCopyArray([ 0.0, -1.5, 0]);
    entity6.localPosition = Rn.Vector3.fromCopyArray([ 3.0, -1.5, 0]);

    entities.push(entity1);
    entities.push(entity2);
    entities.push(entity3);
    entities.push(entity4);
    entities.push(entity5);
    entities.push(entity6);

    const startTime = Date.now();
    let p = null;
    let count = 0

    // camera
    const cameraEntity = Rn.createCameraControllerEntity(engine);
    cameraEntity.localPosition = Rn.Vector3.fromCopyArray([0, 0, 8]);
    const cameraComponent = cameraEntity.getCamera();
    cameraComponent.zNear = 0.1;
    cameraComponent.zFar = 1000;
    cameraComponent.setFovyAndChangeFocalLength(45);
    cameraComponent.aspect = window.innerWidth / window.innerHeight;

    // renderPass
    const renderPass = new Rn.RenderPass(engine);
    renderPass.cameraComponent = cameraComponent;
    renderPass.toClearColorBuffer = true;
    renderPass.clearColor = Rn.Vector4.fromCopyArray4([0, 0, 0, 1]);
    renderPass.addEntities(entities);

    // expression
    const expression = new Rn.Expression(engine);
    expression.addRenderPasses([renderPass]);

    let axis = Rn.Vector3.fromCopyArray([1, 1, 1]);

    const draw = function(time) {

        const date = new Date();

        const rotation = 0.001 * (date.getTime() - startTime);

        entity1.localEulerAngles = Rn.Vector3.fromCopyArray([-Math.PI / 2, rotation, 0]);
        entity2.localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, 0]);
        entity3.localEulerAngles = Rn.Vector3.fromCopyArray([-Math.PI, rotation, 0]);
        entity4.localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, 0]);
        entity5.localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, 0]);
        entity6.localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, 0]);

        engine.process([expression]);

        count++;
        requestAnimationFrame(draw);
    }

    draw();
}

document.body.onload = load;
