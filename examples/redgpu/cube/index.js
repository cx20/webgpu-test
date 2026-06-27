import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.OrbitController(redGPUContext);
        controller.distance = 3;
        controller.tilt = -20;

        const scene = new RedGPU.Display.Scene();
        scene.useBackgroundColor = true;
        scene.backgroundColor.setColorByHEX('#ffffff');

        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        // RedGPU delivers a per-vertex color (vertexColor_0) to the fragment shader
        // only through the PBR vertex path, which is selected when the geometry's
        // interleaved struct is labeled 'PBR'. So we build a full PBR vertex layout
        // (position / normal / uv / uv1 / color / tangent) and assign one color per face.
        const VC = RedGPU.Resource.VertexInterleaveType;
        const interleavedStruct = new RedGPU.Resource.VertexInterleavedStruct(
            {
                aVertexPosition: VC.float32x3,
                aVertexNormal:   VC.float32x3,
                aTexcoord:       VC.float32x2,
                aTexcoord1:      VC.float32x2,
                aVertexColor_0:  VC.float32x4,
                aVertexTangent:  VC.float32x4,
            },
            'PBR'
        );

        // 24 vertices (6 faces x 4), one color per face.
        // position(x,y,z)   normal(x,y,z)   uv   uv1   color(r,g,b,a)        tangent
        const interleaveData = new Float32Array([
            // Front face (red)
            -0.5, -0.5,  0.5,   0, 0, 1,   0, 0,  0, 0,   1.0, 0.0, 0.0, 1.0,   1, 0, 0, 1,
             0.5, -0.5,  0.5,   0, 0, 1,   0, 0,  0, 0,   1.0, 0.0, 0.0, 1.0,   1, 0, 0, 1,
             0.5,  0.5,  0.5,   0, 0, 1,   0, 0,  0, 0,   1.0, 0.0, 0.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5,  0.5,   0, 0, 1,   0, 0,  0, 0,   1.0, 0.0, 0.0, 1.0,   1, 0, 0, 1,
            // Back face (yellow)
            -0.5, -0.5, -0.5,   0, 0,-1,   0, 0,  0, 0,   1.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
             0.5, -0.5, -0.5,   0, 0,-1,   0, 0,  0, 0,   1.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
             0.5,  0.5, -0.5,   0, 0,-1,   0, 0,  0, 0,   1.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5, -0.5,   0, 0,-1,   0, 0,  0, 0,   1.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
            // Top face (green)
             0.5,  0.5,  0.5,   0, 1, 0,   0, 0,  0, 0,   0.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5,  0.5,   0, 1, 0,   0, 0,  0, 0,   0.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5, -0.5,   0, 1, 0,   0, 0,  0, 0,   0.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
             0.5,  0.5, -0.5,   0, 1, 0,   0, 0,  0, 0,   0.0, 1.0, 0.0, 1.0,   1, 0, 0, 1,
            // Bottom face (pink)
            -0.5, -0.5,  0.5,   0,-1, 0,   0, 0,  0, 0,   1.0, 0.5, 0.5, 1.0,   1, 0, 0, 1,
             0.5, -0.5,  0.5,   0,-1, 0,   0, 0,  0, 0,   1.0, 0.5, 0.5, 1.0,   1, 0, 0, 1,
             0.5, -0.5, -0.5,   0,-1, 0,   0, 0,  0, 0,   1.0, 0.5, 0.5, 1.0,   1, 0, 0, 1,
            -0.5, -0.5, -0.5,   0,-1, 0,   0, 0,  0, 0,   1.0, 0.5, 0.5, 1.0,   1, 0, 0, 1,
            // Right face (magenta)
             0.5, -0.5,  0.5,   1, 0, 0,   0, 0,  0, 0,   1.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
             0.5,  0.5,  0.5,   1, 0, 0,   0, 0,  0, 0,   1.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
             0.5,  0.5, -0.5,   1, 0, 0,   0, 0,  0, 0,   1.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
             0.5, -0.5, -0.5,   1, 0, 0,   0, 0,  0, 0,   1.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
            // Left face (blue)
            -0.5, -0.5,  0.5,  -1, 0, 0,   0, 0,  0, 0,   0.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5,  0.5,  -1, 0, 0,   0, 0,  0, 0,   0.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
            -0.5,  0.5, -0.5,  -1, 0, 0,   0, 0,  0, 0,   0.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
            -0.5, -0.5, -0.5,  -1, 0, 0,   0, 0,  0, 0,   0.0, 0.0, 1.0, 1.0,   1, 0, 0, 1,
        ]);
        const indexData = new Uint32Array([
             0,  1,  2,    0,  2,  3, // Front
             4,  5,  6,    4,  6,  7, // Back
             8,  9, 10,    8, 10, 11, // Top
            12, 13, 14,   12, 14, 15, // Bottom
            16, 17, 18,   16, 18, 19, // Right
            20, 21, 22,   20, 22, 23, // Left
        ]);

        const geometry = new RedGPU.Geometry(
            redGPUContext,
            new RedGPU.Resource.VertexBuffer(redGPUContext, interleaveData, interleavedStruct),
            new RedGPU.Resource.IndexBuffer(redGPUContext, indexData)
        );

        // Unlit + vertex color => the fragment outputs the interpolated vertex color
        // directly, so each face shows its assigned solid color without lighting.
        const material = new RedGPU.Material.PBRMaterial(redGPUContext);
        material.useVertexColor = true;
        material.useKHR_materials_unlit = true;

        const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
        mesh.primitiveState.cullMode = RedGPU.GPU_CULL_MODE.NONE;
        scene.addChild(mesh);

        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {
            mesh.rotationX += 0.5;
            mesh.rotationY += 0.5;
            mesh.rotationZ += 0.5;
        });
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
