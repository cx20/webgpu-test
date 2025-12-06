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
  const engine = await Rn.Engine.init({
    approach: Rn.ProcessApproach.WebGPU,
    canvas: c,
  });

  function resizeCanvas() {
      engine.resizeCanvas(window.innerWidth, window.innerHeight);
  }
  
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const cameraEntity = Rn.createCameraControllerEntity(engine);
  const cameraComponent = cameraEntity.getCamera();
  cameraComponent.zNear = 0.1;
  cameraComponent.zFar = 1000;
  cameraComponent.setFovyAndChangeFocalLength(60);
  cameraComponent.aspect = window.innerWidth / window.innerHeight;
  const cameraControllerComponent = cameraEntity.getCameraController();

  const lightEntity1 = Rn.createLightEntity(engine);
  const lightComponent1 = lightEntity1.getLight();
  lightComponent1.type = Rn.LightType.Directional;
  lightEntity1.getTransform().localPosition = Rn.Vector3.fromCopyArray([1.0, 1.0, 100000.0]);
  lightEntity1.getComponent(Rn.LightComponent).intensity = 1;
  lightEntity1.getComponent(Rn.LightComponent).type = Rn.LightType.Directional;
  lightEntity1.getTransform().localEulerAngles = Rn.Vector3.fromCopyArray([Math.PI / 2, Math.PI / 4, Math.PI / 4]);

  const allRenderPasses = [];
  let targetEntities = null;

  for (let i = 0; i < modelInfoSet.length; i++) {
    const modelInfo = modelInfoSet[i];
    try {

      const expression = await Rn.GltfImporter.importFromUrl(
        engine,
        modelInfo.url,
        {
          cameraComponent: cameraComponent,
          defaultMaterialHelperArgumentArray: [
            {
              makeOutputSrgb: true,
            },
          ],
        }
      );

      const mainRenderPass = expression.renderPasses[0];
      const entities = mainRenderPass.entities;

      for (let entity of entities) {
        const sceneGraph = entity.getSceneGraph();
        if (!sceneGraph.parent) {
          const transform = entity.getTransform();
          transform.localScale = Rn.Vector3.fromCopyArray([modelInfo.scale, modelInfo.scale, modelInfo.scale]);
          transform.localEulerAngles = Rn.Vector3.fromCopyArray([modelInfo.rotation[0], modelInfo.rotation[1], modelInfo.rotation[2]]);
          transform.localPosition = Rn.Vector3.fromCopyArray([modelInfo.position[0], modelInfo.position[1], modelInfo.position[2]]);
        }
      }

      if (modelInfo.name === "Fox") {
        targetEntities = entities;
      }

      allRenderPasses.push(mainRenderPass);

    } catch (error) {
      console.error(`Failed to load model ${modelInfo.name}:`, error);
    }
  }

  if (allRenderPasses.length === 0) {
    console.error('No models were successfully loaded');
    return;
  }

  for (let i = 0; i < allRenderPasses.length; i++) {
    const renderPass = allRenderPasses[i];
    if (i === 0) {
      renderPass.toClearColorBuffer = true;
      renderPass.toClearDepthBuffer = true;
      renderPass.clearColor = Rn.Vector4.fromCopyArray4([0.2, 0.2, 0.2, 1]);
    } else {
      renderPass.toClearColorBuffer = false;
      renderPass.toClearDepthBuffer = false;
    }
  }

  const expression = new Rn.Expression(engine);
  expression.addRenderPasses(allRenderPasses);

  if (targetEntities) {
    cameraControllerComponent.controller.setTargets(targetEntities);
  }

  let startTime = Date.now();
  const draw = function () {
    const date = new Date();
    const time = (date.getTime() - startTime) / 1000;
    Rn.AnimationComponent.setGlobalTime(engine, time);
    if (time > Rn.AnimationComponent.getEndInputValue(engine)) {
      startTime = date.getTime();
    }

    engine.process([expression]);
    requestAnimationFrame(draw);
  };
  
  draw();
}

document.body.onload = load;
