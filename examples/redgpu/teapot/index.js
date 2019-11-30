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
import RedStandardMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/material/RedStandardMaterial.js";
import RedDirectionalLight from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/light/RedDirectionalLight.js";

(async function () {
    const c = document.getElementById('canvas');
    const glslangModule = await import(/* webpackIgnore: true */ 'https://unpkg.com/@webgpu/glslang@0.0.9/dist/web-devel/glslang.js');

    const glslang = await glslangModule.default();
    let redGPU = new RedGPU(c, glslang,
        function () {

            let tScene = new RedScene();
            tScene.backgroundColor = '#000';
            
            let tCamera = new RedObitController(this);
            let tView = new RedView(this, tScene, tCamera);
            redGPU.addView(tView);
            tCamera.distance = 40;

            let tLight = new RedDirectionalLight('#fff', 1.0);
            tLight.x = 10;
            tLight.y = 10;
            tLight.z = 10;
            tScene.addLight(tLight)

            redGPU.view = tView
            redGPU.setSize(window.innerWidth, window.innerHeight);

            let interleaveData;
            let indexData;

            // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
            $.getJSON("../../../assets/json/teapot.json", function (data) {

                let vertexPositions = data.vertexPositions;
                let vertexTextureCoords = data.vertexTextureCoords;
                let vertexNormals = data.vertexNormals;
                let indices = data.indices;

                let interleaveDataBuffer = [];
                let len = vertexPositions.length / 3;
                for (let i = 0; i < len; i++ ) {
                    interleaveDataBuffer.push(vertexPositions[i*3+0]);
                    interleaveDataBuffer.push(vertexPositions[i*3+1]);
                    interleaveDataBuffer.push(vertexPositions[i*3+2]);
                    interleaveDataBuffer.push(vertexNormals[i*3+0]);
                    interleaveDataBuffer.push(vertexNormals[i*3+1]);
                    interleaveDataBuffer.push(vertexNormals[i*3+2]);
                    interleaveDataBuffer.push(vertexTextureCoords[i*2+0]);
                    interleaveDataBuffer.push(vertexTextureCoords[i*2+1]);
                }
                interleaveData = new Float32Array(interleaveDataBuffer);
                indexData = new Uint16Array(indices);

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
                // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
                let texture = new RedBitmapTexture(redGPU, '../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg');
                let material  = new RedStandardMaterial(redGPU, texture);
                let tMesh = new RedMesh(redGPU, geometry, material);
                tMesh.cullMode = 'none';
                tScene.addChild(tMesh);

                let renderer = new RedRender();
                let render = function (time) {
                    //tMesh.rotationX += 1;
                    tMesh.rotationY += 1;
                    //tMesh.rotationZ += 1;
                    renderer.render(time, redGPU, tView);
                    requestAnimationFrame(render);
                };

                requestAnimationFrame(render);
            });
        }
    );

})();
