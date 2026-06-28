import { mat4 } from "wgpu-matrix";
import {
    makeShaderDataDefinitions,
    makeStructuredView,
    createBuffersAndAttributesFromArrays,
    createTextureFromImage,
    primitives,
} from "webgpu-utils";

const TEXTURE_URL = "../../../assets/textures/earth.jpg";

// ========== Spherical UV mapping (for the hand-built polyhedra) ==========

function sphericalUV(x, y, z) {
    const len = Math.hypot(x, y, z);
    if (len === 0) return [0.5, 0.5];
    const nx = x / len, ny = y / len, nz = z / len;
    const u = 0.5 - Math.atan2(nz, nx) / (2 * Math.PI);
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
    return [u, v];
}

function polyhedronFromFaces(vertices, faces) {
    const position = [];
    const texcoord = [];
    for (const face of faces) {
        for (const idx of face) {
            const vtx = vertices[idx];
            position.push(...vtx);
            texcoord.push(...sphericalUV(...vtx));
        }
    }
    return {
        position: new Float32Array(position),
        texcoord: new Float32Array(texcoord),
    };
}

function createTetrahedron(radius) {
    const a = radius * Math.sqrt(8 / 9);
    const b = radius * Math.sqrt(2 / 9);
    const c = radius * Math.sqrt(2 / 3);
    const d = radius / 3;
    const vertices = [
        [0, radius, 0], [-c, -d, -b], [c, -d, -b], [0, -d, a],
    ];
    const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
    return polyhedronFromFaces(vertices, faces);
}

function createOctahedron(radius) {
    const vertices = [
        [0, radius, 0], [0, -radius, 0],
        [radius, 0, 0], [-radius, 0, 0],
        [0, 0, radius], [0, 0, -radius],
    ];
    const faces = [
        [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
        [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3],
    ];
    return polyhedronFromFaces(vertices, faces);
}

// Keep only position + texcoord so every shape shares one vertex layout.
// Omit `indices` entirely when absent (the hand-built polyhedra are non-indexed);
// passing `indices: undefined` makes webgpu-utils throw.
function positionAndTexcoord(verts) {
    const arrays = { position: verts.position, texcoord: verts.texcoord };
    if (verts.indices) {
        arrays.indices = verts.indices;
    }
    return arrays;
}

async function main() {
    const gpu = navigator.gpu;
    if (!gpu) {
        alert("WebGPU is not supported in this browser.");
        return;
    }

    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const canvas = document.getElementById("c");
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;

    const context = canvas.getContext("webgpu");
    const presentationFormat = gpu.getPreferredCanvasFormat(adapter);
    context.configure({
        device,
        format: presentationFormat,
        alphaMode: "opaque",
    });

    const shaderSrc = document.getElementById("shader").textContent;
    const shaderModule = device.createShaderModule({ code: shaderSrc });
    const defs = makeShaderDataDefinitions(shaderSrc);

    // ========== Build primitives (webgpu-utils where available) ==========
    const spacing = 2.5;
    const shapeDefs = [
        { name: "Plane",    pos: [-spacing,  spacing, 0], verts: primitives.createPlaneVertices({ width: 1.5, depth: 1.5, subdivisionsWidth: 4, subdivisionsDepth: 4 }) },
        { name: "Cube",     pos: [0,         spacing, 0], verts: primitives.createCubeVertices({ size: 1.4 }) },
        { name: "Sphere",   pos: [spacing,   spacing, 0], verts: primitives.createSphereVertices({ radius: 0.8, subdivisionsAxis: 48, subdivisionsHeight: 32 }) },
        { name: "Circle",   pos: [-spacing,  0, 0], verts: primitives.createDiscVertices({ radius: 0.8, divisions: 32 }), rotateX: -Math.PI / 2 },
        { name: "Cylinder", pos: [0,         0, 0], verts: primitives.createTruncatedConeVertices({ bottomRadius: 0.6, topRadius: 0.6, height: 1.2, radialSubdivisions: 32 }) },
        { name: "Cone",     pos: [spacing,   0, 0], verts: primitives.createTruncatedConeVertices({ bottomRadius: 0.7, topRadius: 0.0, height: 1.2, radialSubdivisions: 32 }) },
        { name: "Tetra",    pos: [-spacing, -spacing, 0], verts: createTetrahedron(0.8) },
        { name: "Octa",     pos: [0,        -spacing, 0], verts: createOctahedron(0.8) },
        { name: "Torus",    pos: [spacing,  -spacing, 0], verts: primitives.createTorusVertices({ radius: 0.5, thickness: 0.25, radialSubdivisions: 32, bodySubdivisions: 16 }) },
    ];

    const texture = await createTextureFromImage(device, TEXTURE_URL, { mips: true });
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
    });

    // Create GPU buffers + per-shape uniform/bind group
    const shapes = shapeDefs.map((def) => {
        const vertices = createBuffersAndAttributesFromArrays(device, positionAndTexcoord(def.verts));
        const uniformValues = makeStructuredView(defs.uniforms.uniforms);
        const uniformBuffer = device.createBuffer({
            size: uniformValues.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        return { ...def, vertices, uniformValues, uniformBuffer };
    });

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: shapes[0].vertices.bufferLayouts,
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{ format: presentationFormat }],
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "none",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
    });

    for (const shape of shapes) {
        shape.bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: shape.uniformBuffer } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: texture.createView() },
            ],
        });
    }

    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth * devicePixelRatio;
        canvas.height = window.innerHeight * devicePixelRatio;
        depthTexture.destroy();
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: "depth24plus",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    });

    function render(timestamp) {
        const time = timestamp / 1000;

        const aspect = canvas.width / canvas.height;
        const projection = mat4.perspective(Math.PI / 4, aspect, 0.1, 100);
        // wgpu-matrix mat4.lookAt returns a camera (object-to-world) matrix,
        // so invert it to get the view matrix.
        const camera = mat4.lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);
        const view = mat4.inverse(camera);
        const viewProjection = mat4.multiply(projection, view);

        const renderPassDescriptor = {
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0.0, g: 0.0, b: 0.02, a: 1.0 },
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: "clear",
                depthStoreOp: "store",
            },
        };

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);

        for (const shape of shapes) {
            let model = mat4.translation(shape.pos);
            model = mat4.rotateY(model, time * 0.5);
            if (shape.rotateX) {
                model = mat4.rotateX(model, shape.rotateX);
            }
            const modelViewProjection = mat4.multiply(viewProjection, model);

            shape.uniformValues.set({ modelViewProjection });
            device.queue.writeBuffer(shape.uniformBuffer, 0, shape.uniformValues.arrayBuffer);

            passEncoder.setBindGroup(0, shape.bindGroup);
            passEncoder.setVertexBuffer(0, shape.vertices.buffers[0]);
            if (shape.vertices.indexBuffer) {
                passEncoder.setIndexBuffer(shape.vertices.indexBuffer, shape.vertices.indexFormat);
                passEncoder.drawIndexed(shape.vertices.numElements);
            } else {
                passEncoder.draw(shape.vertices.numElements);
            }
        }

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();
