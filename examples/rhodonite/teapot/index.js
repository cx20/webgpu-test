import Rn from 'rhodonite';

async function readyTeapotVerticesData(data) {

    const positions = new Float32Array(data.vertexPositions);
    const normals   = new Float32Array(data.vertexNormals);
    const texcoords = new Float32Array(data.vertexTextureCoords);
    const indices   = new Uint32Array(data.indices);
    
    const material = Rn.MaterialHelper.createClassicUberMaterial();
	const assets = await Rn.defaultAssetLoader.load({
    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
		texture: Rn.Texture.loadFromUrl('../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg')
	});

    const sampler = new Rn.Sampler({
      magFilter: Rn.TextureParameter.Linear,
      minFilter: Rn.TextureParameter.Linear,
      wrapS: Rn.TextureParameter.Repeat,
      wrapT: Rn.TextureParameter.Repeat,
    });
    sampler.create();

    material.setTextureParameter('diffuseColorTexture', assets.texture, sampler);

    const primitive = Rn.Primitive.createPrimitive({
        indices: indices,
        attributeSemantics: [Rn.VertexAttribute.Position.XYZ, Rn.VertexAttribute.Normal.XYZ, Rn.VertexAttribute.Texcoord0.XY],
        attributes: [positions, normals, texcoords],
        material: material,
        primitiveMode: Rn.PrimitiveMode.Triangles
    });

    // https://github.com/actnwit/RhodoniteTS/blob/master/src/foundation/definitions/ShadingModel.ts
    // ShadingModel enum has the following values.
    // 0: Constant(No Lights)
    // 1: Lambert
    // 2: BlinnPhong
    // 3: Phong
    primitive.material.setParameter(Rn.ShaderSemantics.ShadingModel, 1);

    return primitive;
}

let vertexPositions;
let vertexNormals;
let vertexTextureCoords;
let indices;

const load = async function () {
    Rn.Config.dataTextureWidth  = 2 ** 9; // default: 2 ** 11;
    Rn.Config.dataTextureHeight = 2 ** 9; // default: 2 ** 11;

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
    
    const promise = Rn.ModuleManager.getInstance().loadModule('webgpu');
    Promise.all([promise]).then(function() {
        // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
        $.getJSON("../../../assets/json/teapot.json", function (data) {
            init(data);
        });

    });
    
    async function init(data) {
        resizeCanvas();
        
        window.addEventListener("resize", function(){
            resizeCanvas();
        });
        
        const primitive = await readyTeapotVerticesData(data);

        Rn.MeshRendererComponent.manualTransparentSids = [];

        const entities = [];
        const originalMesh = new Rn.Mesh();
        originalMesh.addPrimitive(primitive);
        const entity = Rn.createMeshEntity();

        entities.push(entity);
        const meshComponent = entity.getComponent(Rn.MeshComponent);

        meshComponent.setMesh(originalMesh);
        entity.getTransform().toUpdateAllTransform = false;

        const startTime = Date.now();
        const rotationVec3 = Rn.MutableVector3.zero();

        // camera
        const cameraEntity = Rn.createCameraControllerEntity();
        cameraEntity.localPosition = Rn.Vector3.fromCopyArray([0, 0, 35]);
        const cameraComponent = cameraEntity.getCamera();
        cameraComponent.zNear = 0.1;
        cameraComponent.zFar = 1000;
        cameraComponent.setFovyAndChangeFocalLength(45);
        cameraComponent.aspect = window.innerWidth / window.innerHeight;

        // TODO: Light is not applied correctly
        // Lights
        const lightEntity = Rn.createLightEntity();
        const lightComponent = lightEntity.getLight();
        lightComponent.type = Rn.LightType.Point;
        lightComponent.intensity = 1;
        lightEntity.localPosition = Rn.Vector3.fromCopyArray([100, 0, 100]);

        // renderPass
        const renderPass = new Rn.RenderPass();
        renderPass.cameraComponent = cameraComponent;
        renderPass.toClearColorBuffer = true;
        renderPass.toClearDepthBuffer = true;
        renderPass.clearColor = Rn.Vector4.fromCopyArray4([0, 0, 0, 1]);
        renderPass.addEntities(entities);

        // expression
        const expression = new Rn.Expression();
        expression.addRenderPasses([renderPass]);

        const draw = function(time) {

            const date = new Date();

            const rotation = 0.001 * (date.getTime() - startTime);
            entities.forEach(function (entity) {
                entity.getTransform().localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, 0]);
            });

            Rn.System.process([expression]);

            requestAnimationFrame(draw);
        }

        draw();
    }
}

document.body.onload = load;
