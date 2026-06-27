import * as RedGPU from "https://redcamel.github.io/RedGPU/dist/index.js";

const canvas = document.getElementById('canvas');
canvas.width = 512;
canvas.height = 512;

const VC = RedGPU.Resource.VertexInterleaveType;

// RedGPU has no Tetrahedron / Octahedron primitive, so build them from raw
// triangles. BitmapMaterial uses the basic (non-PBR) vertex layout, whose input
// is position / normal / uv / tangent, so the geometry must provide those.
function makePolyhedron(redGPUContext, triangles) {
    const data = [];
    const indices = [];
    const faceUV = [[0, 0], [1, 0], [0.5, 1]];
    let idx = 0;
    for (const [a, b, c] of triangles) {
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
        const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        [a, b, c].forEach((p, i) => {
            data.push(p[0], p[1], p[2], nx, ny, nz, faceUV[i][0], faceUV[i][1], 1, 0, 0, 1);
        });
        indices.push(idx, idx + 1, idx + 2);
        idx += 3;
    }
    const interleavedStruct = new RedGPU.Resource.VertexInterleavedStruct({
        vertexPosition: VC.float32x3,
        vertexNormal:   VC.float32x3,
        texcoord:       VC.float32x2,
        vertexTangent:  VC.float32x4,
    });
    return new RedGPU.Geometry(
        redGPUContext,
        new RedGPU.Resource.VertexBuffer(redGPUContext, new Float32Array(data), interleavedStruct),
        new RedGPU.Resource.IndexBuffer(redGPUContext, new Uint32Array(indices))
    );
}

function makeTetrahedron(redGPUContext, radius) {
    const s = radius / Math.sqrt(3);
    const A = [s, s, s], B = [-s, -s, s], C = [-s, s, -s], D = [s, -s, -s];
    return makePolyhedron(redGPUContext, [
        [A, C, B], [A, B, D], [A, D, C], [B, C, D],
    ]);
}

function makeOctahedron(redGPUContext, r) {
    const Xp = [r, 0, 0], Xn = [-r, 0, 0];
    const Yp = [0, r, 0], Yn = [0, -r, 0];
    const Zp = [0, 0, r], Zn = [0, 0, -r];
    return makePolyhedron(redGPUContext, [
        [Yp, Zp, Xp], [Yp, Xp, Zn], [Yp, Zn, Xn], [Yp, Xn, Zp],
        [Yn, Xp, Zp], [Yn, Zn, Xp], [Yn, Xn, Zn], [Yn, Zp, Xn],
    ]);
}

RedGPU.init(
    canvas,
    (redGPUContext) => {
        const controller = new RedGPU.Camera.OrbitController(redGPUContext);
        controller.distance = 9;
        controller.tilt = 0;
        controller.camera.fieldOfView = 30;

        const scene = new RedGPU.Display.Scene();
        scene.useBackgroundColor = true;
        scene.backgroundColor.setColorByHEX('#000000');

        const view = new RedGPU.Display.View3D(redGPUContext, scene, controller);
        redGPUContext.addView(view);

        // copy from: https://github.com/gpjt/webgl-lessons (earth texture)
        const texture = new RedGPU.Resource.BitmapTexture(redGPUContext, '../../../assets/textures/earth.jpg');
        const material = new RedGPU.Material.BitmapMaterial(redGPUContext, texture);

        // 3x3 grid of primitives, all sharing the same textured material.
        const items = [
            { geometry: new RedGPU.Primitive.Plane(redGPUContext, 1, 1, 10, 10),       pos: [-1.5,  1.5, 0] },
            { geometry: new RedGPU.Primitive.Box(redGPUContext, 1, 1, 1),              pos: [ 0.0,  1.5, 0] },
            { geometry: new RedGPU.Primitive.Sphere(redGPUContext, 0.5, 24, 24),       pos: [ 1.5,  1.5, 0] },
            // RedGPU's Circle lies on the XZ plane, so stand it up (rotationX 90) to face the camera.
            { geometry: new RedGPU.Primitive.Circle(redGPUContext, 0.5, 24),           pos: [-1.5,  0.0, 0], baseRotX: 90 },
            { geometry: new RedGPU.Primitive.Cylinder(redGPUContext, 0.5, 0.5, 1, 24), pos: [ 0.0,  0.0, 0] },
            { geometry: new RedGPU.Primitive.Cone(redGPUContext, 0.5, 1, 24),          pos: [ 1.5,  0.0, 0] },
            { geometry: makeTetrahedron(redGPUContext, 0.5),                           pos: [-1.5, -1.5, 0], noCull: true },
            { geometry: makeOctahedron(redGPUContext, 0.5),                            pos: [ 0.0, -1.5, 0], noCull: true },
            { geometry: new RedGPU.Primitive.Torus(redGPUContext, 0.4, 0.2, 16, 100),  pos: [ 1.5, -1.5, 0] },
        ];

        const meshes = items.map(({ geometry, pos, baseRotX, noCull }) => {
            const mesh = new RedGPU.Display.Mesh(redGPUContext, geometry, material);
            mesh.setPosition(pos[0], pos[1], pos[2]);
            if (baseRotX) mesh.rotationX = baseRotX;
            if (noCull) mesh.primitiveState.cullMode = RedGPU.GPU_CULL_MODE.NONE;
            scene.addChild(mesh);
            return mesh;
        });

        let angle = 0;
        const renderer = new RedGPU.Renderer(redGPUContext);
        renderer.start(redGPUContext, () => {
            angle += 1;
            for (const mesh of meshes) mesh.rotationY = angle;
        });
    },
    (failReason) => {
        console.error('Initialization failed:', failReason);
    }
);
