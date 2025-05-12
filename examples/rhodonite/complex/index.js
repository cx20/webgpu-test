import Rn from 'rhodonite';

let modelInfoSet = [
{
    name: "CesiumMilkTruck",
    scale: 0.4,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, -2],
    url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"
}, {
    name: "Fox",
    scale: 0.05,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 0],
    url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"
}, {
    name: "Rex",
    scale: 1.0,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 3],
    //url: "https://raw.githubusercontent.com/BabylonJS/Exporters/9bc140006be149687be045f60b4a25cdb45ce4fc/Maya/Samples/glTF 2.0/T-Rex/trex_running.gltf" // scale:0.01
    url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf" // scale:1.0
}];

let p = null;
let scale = 1;

const c = document.getElementById('world');
c.width = window.innerWidth;
c.height = window.innerHeight;

const load = async function () {
  Rn.Config.dataTextureWidth  = 2 ** 9; // default: 2 ** 11;
  Rn.Config.dataTextureHeight = 2 ** 9; // default: 2 ** 11;

  await Rn.ModuleManager.getInstance().loadModule('webgpu');
  const c = document.getElementById('world');

  await Rn.System.init({
    approach: Rn.ProcessApproach.WebGPU,
    canvas: c,
  });

  resizeCanvas();
  
  window.addEventListener("resize", function(){
      resizeCanvas();
  });

  function resizeCanvas() {
      Rn.System.resizeCanvas(window.innerWidth, window.innerHeight);
  }

  
  // camera
  const cameraEntity = Rn.createCameraControllerEntity();
  const cameraComponent = cameraEntity.getCamera();
  cameraComponent.zNear = 0.1;
  cameraComponent.zFar = 1000;
  cameraComponent.setFovyAndChangeFocalLength(60);
  cameraComponent.aspect = window.innerWidth / window.innerHeight;
  const cameraControllerComponent = cameraEntity.getCameraController();

  // Lights
  const lightEntity1 = Rn.createLightEntity();
  const lightComponent1 = lightEntity1.getLight();
  lightComponent1.type = Rn.LightType.Directional;
  lightEntity1.getTransform().localPosition = Rn.Vector3.fromCopyArray([1.0, 1.0, 100000.0]);
  lightEntity1.getComponent(Rn.LightComponent).intensity = 1;
  lightEntity1.getComponent(Rn.LightComponent).type = Rn.LightType.Directional;
  lightEntity1.getTransform().localEulerAngles = Rn.Vector3.fromCopyArray([Math.PI / 2, Math.PI / 4, Math.PI / 4]);

  // expressions
  const expressions = [];

  let promises = [];
  for (let i = 0; i < modelInfoSet.length; i++ ) {
    const promise = (
      await Rn.Gltf2Importer.importFromUri(modelInfoSet[i].url, {
        defaultMaterialHelperArgumentArray: [
          {
            makeOutputSrgb: false,
          },
        ]
      })
    ).unwrapForce();
    promises.push(promise);
  }
  
  Promise.all(promises).then(function (gltfModels) {
    const rootGroups = [];

    for (let i = 0; i < modelInfoSet.length; i++) {
      let modelInfo = modelInfoSet[i];
      const rootGroup = Rn.ModelConverter.convertToRhodoniteObject(gltfModels[i]);
      rootGroup.getTransform().localScale = Rn.Vector3.fromCopyArray([modelInfo.scale, modelInfo.scale, modelInfo.scale]);
      rootGroup.getTransform().localEulerAngles = Rn.Vector3.fromCopyArray([modelInfo.rotation[0], modelInfo.rotation[1], modelInfo.rotation[2]]);
      rootGroup.getTransform().localPosition = Rn.Vector3.fromCopyArray([modelInfo.position[0], modelInfo.position[1], modelInfo.position[2]]);

      if (modelInfo.name == "Rex") {
        cameraControllerComponent.controller.setTarget(rootGroup);
        const cameraEntity = Rn.createCameraEntity();
        const cameraComponent = cameraEntity.getCamera();
        cameraComponent.zNear = 0.1;
        cameraComponent.zFar = 1000.0;
      }
      
      rootGroups.push(rootGroup);
    }

    const renderPass = new Rn.RenderPass();

    renderPass.addEntities(rootGroups);
    renderPass.toClearColorBuffer = true;
    renderPass.toClearDepthBuffer = true;
    renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.2, 0.2, 0.2, 1]);

    // gamma correction
	const gammaTargetFramebuffer = Rn.RenderableHelper.createFrameBuffer({
		width: 1024,
		height: 1024,
		textureNum: 1,
		textureFormats: [Rn.TextureFormat.RGBA8],
		createDepthBuffer: true,
	  });
	renderPass.setFramebuffer(gammaTargetFramebuffer);

    const gammaCorrectionMaterial = Rn.MaterialHelper.createGammaCorrectionMaterial();
    const gammaRenderPass =
    Rn.RenderPassHelper.createScreenDrawRenderPassWithBaseColorTexture(
    	gammaCorrectionMaterial,
    	gammaTargetFramebuffer.getColorAttachedRenderTargetTexture(0)
    );

    const expression = new Rn.Expression();
    expression.addRenderPasses([renderPass, gammaRenderPass]);
    expressions.push(expression);

    draw();
  });
  
  let startTime = Date.now();
  const draw = function () {

    const date = new Date();
    const rotation = 0.001 * (date.getTime() - startTime);
    const angle = 0.02 * date.getTime();
    const time = (date.getTime() - startTime) / 1000;
    Rn.AnimationComponent.globalTime = time;
    if (time > Rn.AnimationComponent.endInputValue) {
      startTime = date.getTime();
    }
    
    cameraControllerComponent.controller.rotX = -angle;
    
    Rn.System.process(expressions);
    requestAnimationFrame(draw);
  };
}

document.body.onload = load;
