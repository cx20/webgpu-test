import Rn from 'rhodonite';

(function() {
    async function readyBasicVerticesData() {
        // Square data
        //             1.0 y 
        //              ^  -1.0 
        //              | / z
        //              |/       x
        // -1.0 -----------------> +1.0
        //            / |
        //      +1.0 /  |
        //           -1.0
        // 
        //        [0]------[1]
        //         |        |
        //         |        |
        //         |        |
        //        [2]------[3]
        //
        const positions = new Float32Array([ 
            -0.5, 0.5, 0.0, // v0
             0.5, 0.5, 0.0, // v1 
            -0.5,-0.5, 0.0, // v2
             0.5,-0.5, 0.0  // v3
        ]);
        
        const colors = new Float32Array([ 
             1.0, 0.0, 0.0, // v0
             0.0, 1.0, 0.0, // v1
             0.0, 0.0, 1.0, // v2
             1.0, 1.0, 0.0  // v3
        ]);

        const indices = new Uint32Array([
            2, 1, 0,
            2, 3, 1
        ]);

        const primitive = Rn.Primitive.createPrimitive({
            indices: indices,
            attributeSemantics: [Rn.VertexAttribute.Position.XYZ, Rn.VertexAttribute.Color0.XYZ],
            attributes: [positions, colors],
            material: void 0,
            primitiveMode: Rn.PrimitiveMode.Triangles
        });

        return primitive;
    }

    const promises = [];
    promises.push(Rn.ModuleManager.getInstance().loadModule('webgpu'));
    Promise.all(promises).then(async () => {
        await Rn.System.init({
            approach: Rn.ProcessApproach.WebGPU,
            canvas: document.getElementById('world'),
        });

        resizeCanvas();
        
        window.addEventListener("resize", function(){
            resizeCanvas();
        });

        function resizeCanvas() {
            Rn.System.resizeCanvas(window.innerWidth, window.innerHeight);
        }

        const primitive = await readyBasicVerticesData();
    
        Rn.MeshRendererComponent.manualTransparentSids = [];
    
        const originalMesh = new Rn.Mesh();
        originalMesh.addPrimitive(primitive);
        
        const firstEntity = Rn.createMeshEntity();
        const meshComponent = firstEntity.getMesh();
        meshComponent.setMesh(originalMesh);
        
        const draw = function(time) {
            Rn.System.processAuto();
            requestAnimationFrame(draw);
        }
    
        draw();
    });
})();
