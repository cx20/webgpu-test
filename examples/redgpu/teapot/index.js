import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.OrbitController(redGPUContext);
        controller.distance = 40;
        controller.tilt = -10;

        const scene = new RedGPU.Display.Scene();
        scene.useBackgroundColor = true;
        scene.backgroundColor.setColorByHEX('#000000');

        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
        fetch('../../../assets/json/teapot.json')
            .then((response) => response.json())
            .then((data) => {
                const vertexPositions = data.vertexPositions;
                const vertexTextureCoords = data.vertexTextureCoords;
                const vertexNormals = data.vertexNormals;
                const indices = data.indices;

                // BitmapMaterial uses the basic (non-PBR) vertex path, whose input is
                // position / normal / uv / tangent. The teapot model has no tangents,
                // so a dummy tangent is supplied (BitmapMaterial does not use it).
                const interleaveDataBuffer = [];
                const len = vertexPositions.length / 3;
                for (let i = 0; i < len; i++) {
                    interleaveDataBuffer.push(
                        vertexPositions[i * 3 + 0],
                        vertexPositions[i * 3 + 1],
                        vertexPositions[i * 3 + 2],
                        vertexNormals[i * 3 + 0],
                        vertexNormals[i * 3 + 1],
                        vertexNormals[i * 3 + 2],
                        vertexTextureCoords[i * 2 + 0],
                        vertexTextureCoords[i * 2 + 1],
                        1, 0, 0, 1 // tangent (unused by BitmapMaterial)
                    );
                }

                const VC = RedGPU.Resource.VertexInterleaveType;
                const interleavedStruct = new RedGPU.Resource.VertexInterleavedStruct({
                    vertexPosition: VC.float32x3,
                    vertexNormal:   VC.float32x3,
                    texcoord:       VC.float32x2,
                    vertexTangent:  VC.float32x4,
                });

                const geometry = new RedGPU.Geometry(
                    redGPUContext,
                    new RedGPU.Resource.VertexBuffer(redGPUContext, new Float32Array(interleaveDataBuffer), interleavedStruct),
                    new RedGPU.Resource.IndexBuffer(redGPUContext, new Uint32Array(indices))
                );

                // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
                const texture = new RedGPU.Resource.BitmapTexture(redGPUContext, '../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg');
                const material = new RedGPU.Material.BitmapMaterial(redGPUContext, texture);
                // The teapot UVs tile the texture (values exceed 0..1), so the sampler
                // must wrap with 'repeat' instead of the default clamp-to-edge, which
                // would stretch the edge texels across the body.
                material.diffuseTextureSampler = new RedGPU.Resource.Sampler(redGPUContext, {
                    addressModeU: 'repeat',
                    addressModeV: 'repeat',
                });

                const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
                scene.addChild(mesh);

                const renderer = new RedGPU.Renderer(redGPUContext);
                renderer.start(redGPUContext, () => {
                    mesh.rotationY += 0.5;
                });
            });
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
