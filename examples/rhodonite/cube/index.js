import Rn from 'rhodonite';

(function() {
    async function readyBasicVerticesData() {
        // Cube data
        //             1.0 y 
        //              ^  -1.0 
        //              | / z
        //              |/       x
        // -1.0 -----------------> +1.0
        //            / |
        //      +1.0 /  |
        //           -1.0
        // 
        //         [7]------[6]
        //        / |      / |
        //      [3]------[2] |
        //       |  |     |  |
        //       | [4]----|-[5]
        //       |/       |/
        //      [0]------[1]
        //
        const positions = new Float32Array([ 
            // Front face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            // Back face
            -0.5, -0.5, -0.5, // v4
             0.5, -0.5, -0.5, // v5
             0.5,  0.5, -0.5, // v6
            -0.5,  0.5, -0.5, // v7
            // Top face
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
             0.5,  0.5, -0.5, // v6
            // Bottom face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5, -0.5, -0.5, // v5
            -0.5, -0.5, -0.5, // v4
             // Right face
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
             0.5,  0.5, -0.5, // v6
             0.5, -0.5, -0.5, // v5
             // Left face
            -0.5, -0.5,  0.5, // v0
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
            -0.5, -0.5, -0.5  // v4
        ]);
        
        const colors = new Float32Array([ 
            1.0, 0.0, 0.0, // Front face
            1.0, 0.0, 0.0, // Front face
            1.0, 0.0, 0.0, // Front face
            1.0, 0.0, 0.0, // Front face
            1.0, 1.0, 0.0, // Back face
            1.0, 1.0, 0.0, // Back face
            1.0, 1.0, 0.0, // Back face
            1.0, 1.0, 0.0, // Back face
            0.0, 1.0, 0.0, // Top face
            0.0, 1.0, 0.0, // Top face
            0.0, 1.0, 0.0, // Top face
            0.0, 1.0, 0.0, // Top face
            1.0, 0.5, 0.5, // Bottom face
            1.0, 0.5, 0.5, // Bottom face
            1.0, 0.5, 0.5, // Bottom face
            1.0, 0.5, 0.5, // Bottom face
            1.0, 0.0, 1.0, // Right face
            1.0, 0.0, 1.0, // Right face
            1.0, 0.0, 1.0, // Right face
            1.0, 0.0, 1.0, // Right face
            0.0, 0.0, 1.0, // Left face
            0.0, 0.0, 1.0, // Left face
            0.0, 0.0, 1.0, // Left face
            0.0, 0.0, 1.0  // Left face
        ]);

        const indices = new Uint32Array([
             0,  1,  2,    0,  2 , 3,  // Front face
             4,  5,  6,    4,  6 , 7,  // Back face
             8,  9, 10,    8, 10, 11,  // Top face
            12, 13, 14,   12, 14, 15,  // Bottom face
            16, 17, 18,   16, 18, 19,  // Right face
            20, 21, 22,   20, 22, 23   // Left face
        ]);
            
        const primitive = Rn.Primitive.createPrimitive({
            indices: indices,
            attributeSemantics: [Rn.VertexAttribute.Position.XYZ, Rn.VertexAttribute.Color0.XYZ],
            attributes: [positions, colors],
            material: void 0,
            primitiveMode: Rn.PrimitiveMode.Triangles
        });
        primitive.material.cullFace = false;

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
        
        const firstEntity = Rn.EntityHelper.createMeshEntity();
        const meshComponent = firstEntity.getMesh();
        meshComponent.setMesh(originalMesh);
        const entities = [];
        entities.push(firstEntity);

        let count = 0
        // camera
        const cameraEntity = Rn.EntityHelper.createCameraControllerEntity();
        cameraEntity.localPosition = Rn.Vector3.fromCopyArray([0, 0, 3]);
        const cameraComponent = cameraEntity.getCamera();
        cameraComponent.zNear = 0.1;
        cameraComponent.zFar = 1000;
        cameraComponent.setFovyAndChangeFocalLength(45);
        cameraComponent.aspect = window.innerWidth / window.innerHeight;
     
        // renderPass
        const renderPass = new Rn.RenderPass();
        renderPass.cameraComponent = cameraComponent;
        renderPass.toClearColorBuffer = true;
        renderPass.addEntities(entities);

        // expression
        const expression = new Rn.Expression();
        expression.addRenderPasses([renderPass]);

        const startTime = Date.now();
        const draw = function(time) {
            const date = new Date();

            const rotation = 0.001 * (date.getTime() - startTime);
            entities.forEach(function (entity) {
                entity.getTransform().localEulerAngles = Rn.Vector3.fromCopyArray([0, rotation, rotation]);
            });

            Rn.System.process([expression]);

            count++;
            requestAnimationFrame(draw);
        }
    
        draw();
    });
})();
