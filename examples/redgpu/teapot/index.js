import RedGPU from "https://redcamel.github.io/RedGPU/src/RedGPU.js";

const c = document.getElementById('canvas');

let redGPU;
new RedGPU.RedGPUContext(c,
    function () {
        redGPU = this;
        let tScene = new RedGPU.Scene();
        tScene.backgroundColor = '#000';
        
        let tCamera = new RedGPU.ObitController(this);
        let tView = new RedGPU.View(this, tScene, tCamera);
        this.addView(tView);
        tCamera.distance = 40;
        let tLight = new RedGPU.DirectionalLight(this);
        tLight.x = 10;
        tLight.y = 10;
        tLight.z = 10;
        tScene.addLight(tLight)
        this.setSize(window.innerWidth, window.innerHeight);

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

            let geometry = new RedGPU.Geometry(
                redGPU,
                new RedGPU.Buffer(
                    redGPU,
                    'interleaveBuffer',
                    RedGPU.Buffer.TYPE_VERTEX,
                    new Float32Array(interleaveData),
                    [
                        new RedGPU.InterleaveInfo('vertexPosition', 'float3'),
                        new RedGPU.InterleaveInfo('vertexNormal', 'float3'),
                        new RedGPU.InterleaveInfo('texcoord', 'float2')
                    ]
                ),
                new RedGPU.Buffer(
                    redGPU,
                    'indexBuffer',
                    RedGPU.Buffer.TYPE_INDEX,
                    new Uint32Array(indexData)
                )
            );
            // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
            let texture = new RedGPU.BitmapTexture(redGPU, '../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg');
            let material  = new RedGPU.BitmapMaterial(redGPU, texture);
            let tMesh = new RedGPU.Mesh(redGPU, geometry, material);
            tScene.addChild(tMesh);

            let renderer = new RedGPU.Render();
            let render = function (time) {
                //tMesh.rotationX += 1;
                tMesh.rotationY += 1;
                //tMesh.rotationZ += 1;
                renderer.render(time, redGPU);
                requestAnimationFrame(render);
            };

            requestAnimationFrame(render);
        });
    }
);
