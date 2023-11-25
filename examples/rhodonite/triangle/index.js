import Rn from 'rhodonite';

(function() {
    async function readyBasicVerticesData() {
        const positions = new Float32Array([
           -0.5, -0.5, 0.0,
            0.5, -0.5, 0.0,
            0.0,  0.5, 0.0
        ]);
        const colors = new Float32Array([
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
            0.0, 0.0, 1.0,
        ]);
        const indices = new Uint32Array([
            0, 1, 2
        ]);

        const flatMaterial = Rn.MaterialHelper.createFlatMaterial();
        const primitive = Rn.Primitive.createPrimitive({
            material: flatMaterial, // TODO: void 0
            attributeSemantics: [Rn.VertexAttribute.Position.XYZ, Rn.VertexAttribute.Color0.XYZ],
            indices,
            attributes: [positions, colors],
            primitiveMode: Rn.PrimitiveMode.Triangles,
        });

        return primitive;
    }

    const promises = [];
    promises.push(Rn.ModuleManager.getInstance().loadModule('webgpu'));
    Promise.all(promises).then(async () => {
        const gl = await Rn.System.init({
            approach: Rn.ProcessApproach.WebGPU,
            canvas: document.getElementById('world'),
        });

        const primitive = await readyBasicVerticesData();
    
        Rn.MeshRendererComponent.manualTransparentSids = [];
    
        const originalMesh = new Rn.Mesh();
        originalMesh.addPrimitive(primitive);
        
        const firstEntity = Rn.EntityHelper.createMeshEntity();
        const meshComponent = firstEntity.getMesh();
        meshComponent.setMesh(originalMesh);
        
        const draw = function(time) {
            Rn.System.processAuto();
            requestAnimationFrame(draw);
        }
    
        draw();
    });
})();
