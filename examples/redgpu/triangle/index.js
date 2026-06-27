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

        const geometry = new RedGPU.Primitive.Circle(redGPUContext, 1, 3);

        const material = new RedGPU.Material.ColorMaterial(redGPUContext, "#0000ff");

        const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
        // Circle is generated on the XZ plane (normal +Y). Stand it up to face the
        // camera (normal +Z) with one vertex pointing up. Rotation order is Ry*Rx*Rz.
        mesh.setRotation(0, 90, 90);
        mesh.primitiveState.cullMode = RedGPU.GPU_CULL_MODE.NONE;
        scene.addChild(mesh);

        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {});
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);