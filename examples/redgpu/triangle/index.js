import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.ObitController(redGPUContext);
        controller.distance = 5;
        controller.tilt = 0;

        const scene = new RedGPU.Display.Scene();
        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        const geometry = new RedGPU.Primitive.Circle(redGPUContext, 1, 3);

        const material = new RedGPU.Material.ColorMaterial(redGPUContext, "#0000ff");

        const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
        mesh.setRotation(0, 0, 30);
        scene.addChild(mesh);

        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {});
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);