import Rn from 'rhodonite';

function readyBasicVerticesData(engine) {

    const positions = new Float32Array([
         0.0,  0.5, 0.0, // v0
        -0.5, -0.5, 0.0, // v1
         0.5, -0.5, 0.0  // v2
    ]);

    const colors = new Float32Array([
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
    ]);

    const indices = new Uint32Array([
        0, 1, 2
    ]);

    const primitive = Rn.Primitive.createPrimitive(engine, {
        indices: indices,
        attributeSemantics: [Rn.VertexAttribute.Position.XYZ, Rn.VertexAttribute.Color0.XYZ],
        attributes: [positions, colors],
        material: void 0,
        primitiveMode: Rn.PrimitiveMode.Triangles
    });

    return primitive;
}

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
    
    const primitive = readyBasicVerticesData(engine);

    Rn.MeshRendererComponent.manualTransparentSids = [];

    const originalMesh = new Rn.Mesh(engine);
    originalMesh.addPrimitive(primitive);
    
    const firstEntity = Rn.createMeshEntity(engine);
    const meshComponent = firstEntity.getMesh();
    meshComponent.setMesh(originalMesh);

    const draw = function(time) {
        engine.processAuto();
        requestAnimationFrame(draw);
    }

    draw();
}

document.body.onload = load;
