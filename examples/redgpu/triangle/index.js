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
    resizeCanvas();
    window.addEventListener("resize", function(){
        resizeCanvas();
    });

    function resizeCanvas() {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
    }

    const glslangModule = await import(/* webpackIgnore: true */ 'https://unpkg.com/@webgpu/glslang@0.0.9/dist/web-devel/glslang.js');

    const glslang = await glslangModule.default();
    let redGPU = new RedGPU(c, glslang,
        function () {

            let tScene = new RedScene();
            let tCamera = new RedObitController(this)

            let tView = new RedView(this, tScene, tCamera)
            tCamera.targetView = tView // optional
            tCamera.distance = 2

            redGPU.view = tView

            let interleaveData = new Float32Array(
                [
                     0.0,  0.5, 0.0,   0.0, 0.0,-1.0,   0.0, 0.0,
                    -0.5, -0.5, 0.0,   0.0, 0.0,-1.0,   0.0, 0.0,
                     0.5, -0.5, 0.0,   0.0,-0.0,-1.0,   0.0, 0.0
                ]
            );
            let indexData = new Uint16Array(
                [0, 1, 2]
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
            tScene.addChild(testMesh)

            let renderer = new RedRender();
            let render = function (time) {
                renderer.render(time, redGPU, tView);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
        }
    );

})();
