import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.OrbitController(redGPUContext);
        controller.distance = 5;
        controller.tilt = 0;

        const scene = new RedGPU.Display.Scene();
        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        // Square data (XY plane, faces +Z toward the camera)
        //
        //        [0]------[1]
        //         | \      |
        //         |   \    |
        //         |     \  |
        //        [2]------[3]
        //
        // RedGPU passes a per-vertex color (vertexColor_0) to the fragment shader
        // only through the PBR vertex path, which is selected when the geometry's
        // interleaved struct is labeled 'PBR'. So we build a full PBR vertex layout
        // (position / normal / uv / uv1 / color / tangent) and feed per-vertex colors.
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

        // position(x,y,z)   normal(x,y,z)  uv(u,v)  uv1(u,v)  color(r,g,b,a)   tangent(x,y,z,w)
        const interleaveData = new Float32Array([
            -1.0,  1.0, 0.0,   0, 0, 1,   0, 0,   0, 0,   1.0, 0.0, 0.0, 1.0,   1, 0, 0, 1, // v0 red
             1.0,  1.0, 0.0,   0, 0, 1,   1, 0,   0, 0,   0.0, 1.0, 0.0, 1.0,   1, 0, 0, 1, // v1 green
            -1.0, -1.0, 0.0,   0, 0, 1,   0, 1,   0, 0,   0.0, 0.0, 1.0, 1.0,   1, 0, 0, 1, // v2 blue
             1.0, -1.0, 0.0,   0, 0, 1,   1, 1,   0, 0,   1.0, 1.0, 0.0, 1.0,   1, 0, 0, 1, // v3 yellow
        ]);
        const indexData = new Uint32Array([
            2, 1, 0, // v2-v1-v0
            2, 3, 1, // v2-v3-v1
        ]);

        const geometry = new RedGPU.Geometry(
            redGPUContext,
            new RedGPU.Resource.VertexBuffer(redGPUContext, interleaveData, interleavedStruct),
            new RedGPU.Resource.IndexBuffer(redGPUContext, indexData)
        );

        // Unlit + vertex color => the fragment outputs the interpolated vertex color
        // directly, giving a pure gradient without any lighting.
        const material = new RedGPU.Material.PBRMaterial(redGPUContext);
        material.useVertexColor = true;
        material.useKHR_materials_unlit = true;

        const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
        mesh.primitiveState.cullMode = RedGPU.GPU_CULL_MODE.NONE;
        scene.addChild(mesh);

        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {});
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
