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
    url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"
}];

const c = document.getElementById('world');
c.width = window.innerWidth;
c.height = window.innerHeight;

const load = async function () {
  Rn.Config.maxSkeletalBoneNumber = 500;
  Rn.Config.maxSkeletonNumber = 100;
  Rn.Config.maxEntityNumber = 11000;
  Rn.Config.maxCameraNumber = 20;
  Rn.Config.maxSkeletalBoneNumberForUniformMode = 200;
  Rn.Config.maxMaterialInstanceForEachType = 400;
  Rn.Config.dataTextureWidth = 2 ** 13;
  Rn.Config.dataTextureHeight = 2 ** 13;

  await Rn.ModuleManager.getInstance().loadModule('webgpu');
  await Rn.ModuleManager.getInstance().loadModule('pbr');
  const c = document.getElementById('world');

  await Rn.System.init({
    approach: Rn.ProcessApproach.WebGPU,
    canvas: c,
  });

  function resizeCanvas() {
      Rn.System.resizeCanvas(window.innerWidth, window.innerHeight);
  }
  
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  
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

  const loadedAssets = [];
  
  for (let i = 0; i < modelInfoSet.length; i++) {
    try {
      const modelInfo = modelInfoSet[i];
      
      const assets = await Rn.defaultAssetLoader.load({
        gltf: await Rn.GltfImporter.importFromUrl(
          modelInfo.url,
          {
            defaultMaterialHelperArgumentArray: [
              {
                makeOutputSrgb: false,
              },
            ],
          }
        )
      });
      
      loadedAssets.push({
        assets: assets,
        modelInfo: modelInfo
      });
      
    } catch (error) {
      console.error(`Failed to load model ${modelInfo.name}:`, error);
    }
  }
  
  if (loadedAssets.length === 0) {
    console.error('No models were successfully loaded');
    return;
  }

  const allEntities = [];
  
  for (let i = 0; i < loadedAssets.length; i++) {
    const { assets, modelInfo } = loadedAssets[i];
    
    const mainRenderPass = assets.gltf.renderPasses[0];
    const entities = mainRenderPass.entities;
    
    let rootEntity = null;
    for (let entity of entities) {
      const transform = entity.getTransform();
      if (!transform.parent || transform.parent === Rn.TransformComponent.dummyTransformComponent) {
        rootEntity = entity;
        break;
      }
    }
    
    if (!rootEntity && entities.length > 0) {
      rootEntity = entities[0];
    }
    
    if (rootEntity) {
      const transform = rootEntity.getTransform();
      const currentScale = transform.localScale;
      const currentRotation = transform.localEulerAngles;
      const currentPosition = transform.localPosition;
      
      transform.localScale 
	  	= Rn.Vector3.fromCopyArray([modelInfo.scale, modelInfo.scale, modelInfo.scale]);
      transform.localEulerAngles 
	  	= Rn.Vector3.fromCopyArray([modelInfo.rotation[0], modelInfo.rotation[1], modelInfo.rotation[2]]);
      transform.localPosition 
	  	= Rn.Vector3.fromCopyArray([modelInfo.position[0], modelInfo.position[1], modelInfo.position[2]]);
	}
    
    if (modelInfo.name === "Rex") {
      cameraControllerComponent.controller.setTargets(entities);
    }
    
    allEntities.push(...entities);
  }

  const renderPass = new Rn.RenderPass();
  renderPass.addEntities(allEntities);
  renderPass.toClearColorBuffer = true;
  renderPass.toClearDepthBuffer = true;
  renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.2, 0.2, 0.2, 1]);

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
  const expressions = [expression];

  let startTime = Date.now();
  const draw = function () {
    const date = new Date();
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
  
  draw();
}

document.body.onload = load;
