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

        // Box primitive already provides per-face UVs, so a BitmapMaterial maps the
        // texture onto every face. BitmapMaterial is unlit (it outputs the sampled
        // texture color directly), matching the original sample.
        const geometry = new RedGPU.Primitive.Box(redGPUContext, 1, 1, 1);

        const texture = new RedGPU.Resource.BitmapTexture(redGPUContext, '../../../assets/textures/frog.jpg');
        const material = new RedGPU.Material.BitmapMaterial(redGPUContext, texture);

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
