import RedGPU from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedGPU.js";
import RedBuffer from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/buffer/RedBuffer.js";
import RedGeometry from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/geometry/RedGeometry.js";
import RedInterleaveInfo from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/geometry/RedInterleaveInfo.js";
import RedMesh from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/object3D/RedMesh.js";
import RedRender from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/renderer/RedRender.js";
import RedScene from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedScene.js";
import RedView from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedView.js";
import RedObitController from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/controller/RedObitController.js";
import RedBaseMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/base/RedBaseMaterial.js";
import RedShareGLSL from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/base/RedShareGLSL.js";
import RedBitmapMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/material/RedBitmapMaterial.js";
import RedBitmapTexture from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/resources/RedBitmapTexture.js";

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
            redGPU.addView(tView);
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
                    // Front face
                    -0.5, -0.5,  0.5,    0.0,  0.0,  1.0,   0.0, 0.0, // v0
                     0.5, -0.5,  0.5,    0.0,  0.0,  1.0,   1.0, 0.0, // v1
                     0.5,  0.5,  0.5,    0.0,  0.0,  1.0,   1.0, 1.0, // v2
                    -0.5,  0.5,  0.5,    0.0,  0.0,  1.0,   0.0, 1.0, // v3
                    // Back face
                    -0.5, -0.5, -0.5,    0.0,  0.0, -1.0,   1.0, 0.0, // v4
                     0.5, -0.5, -0.5,    0.0,  0.0, -1.0,   1.0, 1.0, // v5
                     0.5,  0.5, -0.5,    0.0,  0.0, -1.0,   0.0, 1.0, // v6
                    -0.5,  0.5, -0.5,    0.0,  0.0, -1.0,   0.0, 0.0, // v7
                    // Top face
                     0.5,  0.5,  0.5,    0.0,  1.0,  0.0,   0.0, 1.0, // v2
                    -0.5,  0.5,  0.5,    0.0,  1.0,  0.0,   0.0, 0.0, // v3
                    -0.5,  0.5, -0.5,    0.0,  1.0,  0.0,   1.0, 0.0, // v7
                     0.5,  0.5, -0.5,    0.0,  1.0,  0.0,   1.0, 1.0, // v6
                    // Bottom face
                    -0.5, -0.5,  0.5,    0.0,  1.5,  0.0,   1.0, 1.0, // v0
                     0.5, -0.5,  0.5,    0.0,  1.5,  0.0,   0.0, 1.0, // v1
                     0.5, -0.5, -0.5,    0.0,  1.5,  0.0,   0.0, 0.0, // v5
                    -0.5, -0.5, -0.5,    0.0,  1.5,  0.0,   1.0, 0.0, // v4
                    // Right face
                     0.5, -0.5,  0.5,    1.0,  0.0,  0.0,   1.0, 0.0, // v1
                     0.5,  0.5,  0.5,    1.0,  0.0,  0.0,   1.0, 1.0, // v2
                     0.5,  0.5, -0.5,    1.0,  0.0,  0.0,   0.0, 1.0, // v6
                     0.5, -0.5, -0.5,    1.0,  0.0,  0.0,   0.0, 0.0, // v5
                    // Left face
                    -0.5, -0.5,  0.5,   -1.0,  0.0,  0.0,   0.0, 0.0, // v0
                    -0.5,  0.5,  0.5,   -1.0,  0.0,  0.0,   1.0, 0.0, // v3
                    -0.5,  0.5, -0.5,   -1.0,  0.0,  0.0,   1.0, 1.0, // v7
                    -0.5, -0.5, -0.5,   -1.0,  0.0,  0.0,   0.0, 1.0  // v4
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
            
            let geometry = new RedGeometry(
                redGPU,
                new RedBuffer(
                    redGPU,
                    'interleaveBuffer',
                    RedBuffer.TYPE_VERTEX,
                    new Float32Array(interleaveData),
                    [
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
            let texture = new RedBitmapTexture(redGPU, '../../../assets/textures/frog.jpg');
            let textureMat = new RedBitmapMaterial(redGPU, texture);
            let tMesh = new RedMesh(redGPU, geometry, textureMat);
            tMesh.cullMode = 'none';
            tScene.addChild(tMesh);

            let renderer = new RedRender();
            let render = function (time) {
                tMesh.rotationX += 1;
                tMesh.rotationY += 1;
                tMesh.rotationZ += 1;
                renderer.render(time, redGPU, tView);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
        }
    );

})();
