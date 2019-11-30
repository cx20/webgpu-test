const BASE_URL = "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/";

import RedGPU from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/RedGPU.js";
import RedBuffer from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/buffer/RedBuffer.js";
import RedGeometry from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/geometry/RedGeometry.js";
import RedInterleaveInfo from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/geometry/RedInterleaveInfo.js";
import RedMesh from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/object3D/RedMesh.js";
import RedRender from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/renderer/RedRender.js";
import RedScene from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/RedScene.js";
import RedView from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/RedView.js";
import RedColorMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/material/RedColorMaterial.js";
import RedObitController from "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/src/controller/RedObitController.js";

(async function () {
    const c = document.getElementById('canvas');
    const glslangModule = await import(/* webpackIgnore: true */ 'https://unpkg.com/@webgpu/glslang@0.0.9/dist/web-devel/glslang.js');

    const glslang = await glslangModule.default();
    let redGPU = new RedGPU(c, glslang,
        function () {

            let tScene = new RedScene();
            tScene.backgroundColor = '#fff';
            
            let tCamera = new RedObitController(this);

            let tView = new RedView(this, tScene, tCamera);
            tCamera.targetView = tView; // optional
            tCamera.distance = 2;

            redGPU.view = tView
            redGPU.setSize(window.innerWidth, window.innerHeight);

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
            let interleaveData = new Float32Array(
                [
/*
                    // x,   y,   z,    r,   g,   b
                    -0.5, 0.5, 0.0,  1.0, 0.0, 0.0,  0.0, 0.0, // v0
                     0.5, 0.5, 0.0,  0.0, 1.0, 0.0,  0.0, 0.0, // v1
                    -0.5,-0.5, 0.0,  0.0, 0.0, 1.0,  0.0, 0.0, // v2
                     0.5,-0.5, 0.0,  1.0, 1.0, 0.0,  0.0, 0.0  // v3
*/
                    // Front face
                    -0.5, -0.5,  0.5,  1.0, 0.0, 0.0,  0.0, 0.0, // v0
                     0.5, -0.5,  0.5,  1.0, 0.0, 0.0,  0.0, 0.0, // v1
                     0.5,  0.5,  0.5,  1.0, 0.0, 0.0,  0.0, 0.0, // v2
                    -0.5,  0.5,  0.5,  1.0, 0.0, 0.0,  0.0, 0.0, // v3
                    // Back face
                    -0.5, -0.5, -0.5,  1.0, 1.0, 0.0,  0.0, 0.0, // v4
                     0.5, -0.5, -0.5,  1.0, 1.0, 0.0,  0.0, 0.0, // v5
                     0.5,  0.5, -0.5,  1.0, 1.0, 0.0,  0.0, 0.0, // v6
                    -0.5,  0.5, -0.5,  1.0, 1.0, 0.0,  0.0, 0.0, // v7
                    // Top face
                     0.5,  0.5,  0.5,  0.0, 1.0, 0.0,  0.0, 0.0, // v2
                    -0.5,  0.5,  0.5,  0.0, 1.0, 0.0,  0.0, 0.0, // v3
                    -0.5,  0.5, -0.5,  0.0, 1.0, 0.0,  0.0, 0.0, // v7
                     0.5,  0.5, -0.5,  0.0, 1.0, 0.0,  0.0, 0.0, // v6
                    // Bottom face
                    -0.5, -0.5,  0.5,  1.0, 0.5, 0.5,  0.0, 0.0, // v0
                     0.5, -0.5,  0.5,  1.0, 0.5, 0.5,  0.0, 0.0, // v1
                     0.5, -0.5, -0.5,  1.0, 0.5, 0.5,  0.0, 0.0, // v5
                    -0.5, -0.5, -0.5,  1.0, 0.5, 0.5,  0.0, 0.0, // v4
                     // Right face
                     0.5, -0.5,  0.5,  1.0, 0.0, 1.0,  0.0, 0.0, // v1
                     0.5,  0.5,  0.5,  1.0, 0.0, 1.0,  0.0, 0.0, // v2
                     0.5,  0.5, -0.5,  1.0, 0.0, 1.0,  0.0, 0.0, // v6
                     0.5, -0.5, -0.5,  1.0, 0.0, 1.0,  0.0, 0.0, // v5
                     // Left face
                    -0.5, -0.5,  0.5,  0.0, 0.0, 1.0,  0.0, 0.0, // v0
                    -0.5,  0.5,  0.5,  0.0, 0.0, 1.0,  0.0, 0.0, // v3
                    -0.5,  0.5, -0.5,  0.0, 0.0, 1.0,  0.0, 0.0, // v7
                    -0.5, -0.5, -0.5,  0.0, 0.0, 1.0,  0.0, 0.0  // v4
                ]
            );
            let indexData = new Uint16Array(
                [
                     0,  1,  2,    0,  2 , 3,  // Front face
                     4,  5,  6,    4,  6 , 7,  // Back face
                     8,  9, 10,    8, 10, 11,  // Top face
                    12, 13, 14,   12, 14, 15,  // Bottom face
                    16, 17, 18,   16, 18, 19,  // Right face
                    20, 21, 22,   20, 22, 23   // Left face
                ]
            );
            
            let mat = new RedColorMaterial(redGPU, '#0000ff');

            let geometry = new RedGeometry(
                redGPU,
                new RedBuffer(
                    redGPU,
                    'interleaveBuffer',
                    RedBuffer.TYPE_VERTEX,
                    new Float32Array(interleaveData),
                    [
                        // TODO: Investigate how to set the vertex color
                        new RedInterleaveInfo('vertexPosition', 'float3'),
                        new RedInterleaveInfo('vertexNormal', 'float3'),
                        new RedInterleaveInfo('texcoord', 'float2')
                    ]
                ),
                new RedBuffer(
                    redGPU,
                    'indexBuffer',
                    RedBuffer.TYPE_INDEX,
                    new Uint32Array(indexData)
                )
            );

            let testMesh = new RedMesh(
                redGPU,
                geometry,
                mat
            );
            testMesh.cullMode = 'none';
            tScene.addChild(testMesh)

            let renderer = new RedRender();
            let render = function (time) {
                testMesh.rotationX += 1;
                testMesh.rotationY += 1;
                testMesh.rotationZ += 1;
                renderer.render(time, redGPU, tView);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
        }
    );

})();
