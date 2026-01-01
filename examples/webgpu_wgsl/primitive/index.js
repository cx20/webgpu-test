import Module from 'https://esm.run/manifold-3d';

const TEXTURE_URL = 'https://cx20.github.io/webgl-test/assets/textures/earth.jpg';

// gl-matrix 3.x uses glMatrix global object
const { mat4, vec3 } = glMatrix;

// ========== Shader Sources ==========
const vertexShaderWGSL = document.getElementById("vs").textContent;
const fragmentShaderWGSL = document.getElementById("fs").textContent;

// ========== UV Mapping Functions ==========

function sphericalUV(x, y, z) {
    const len = Math.hypot(x, y, z);
    if (len === 0) return [0.5, 0.5];
    const nx = x / len, ny = y / len, nz = z / len;
    const u = 0.5 - Math.atan2(nz, nx) / (2 * Math.PI);
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI;
    return [u, v];
}

function cylindricalUV(x, y, z, height = 1) {
    const u = 0.5 - Math.atan2(z, x) / (2 * Math.PI);
    const v = (y + height / 2) / height;
    return [u, v];
}

function boxUV(x, y, z) {
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    if (ax >= ay && ax >= az) {
        return [(z / ax + 1) / 2, (y / ax + 1) / 2];
    } else if (ay >= ax && ay >= az) {
        return [(x / ay + 1) / 2, (z / ay + 1) / 2];
    } else {
        return [(x / az + 1) / 2, (y / az + 1) / 2];
    }
}

function fixSeamUVs(uv0, uv1, uv2) {
    let u0 = uv0[0], u1 = uv1[0], u2 = uv2[0];
    if (Math.abs(u0 - u1) > 0.5) { if (u0 < u1) u0 += 1.0; else u1 += 1.0; }
    if (Math.abs(u1 - u2) > 0.5) { if (u1 < u2) u1 += 1.0; else u2 += 1.0; }
    if (Math.abs(u0 - u2) > 0.5) { if (u0 < u2) u0 += 1.0; else u2 += 1.0; }
    return [[u0, uv0[1]], [u1, uv1[1]], [u2, uv2[1]]];
}

// ========== Manifold to Arrays ==========

function manifoldToArrays(manifold, uvFunc, fixSeam = false) {
    const mesh = manifold.getMesh();
    const vertProps = mesh.vertProperties;
    const triVerts = mesh.triVerts;
    
    const positions = [];
    const uvs = [];
    
    for (let i = 0; i < triVerts.length; i += 3) {
        const i0 = triVerts[i], i1 = triVerts[i + 1], i2 = triVerts[i + 2];
        
        const p0 = [vertProps[i0 * 3], vertProps[i0 * 3 + 1], vertProps[i0 * 3 + 2]];
        const p1 = [vertProps[i1 * 3], vertProps[i1 * 3 + 1], vertProps[i1 * 3 + 2]];
        const p2 = [vertProps[i2 * 3], vertProps[i2 * 3 + 1], vertProps[i2 * 3 + 2]];
        
        positions.push(...p0, ...p1, ...p2);
        
        let uv0 = uvFunc(...p0);
        let uv1 = uvFunc(...p1);
        let uv2 = uvFunc(...p2);
        
        if (fixSeam) {
            [uv0, uv1, uv2] = fixSeamUVs(uv0, uv1, uv2);
        }
        
        uvs.push(...uv0, ...uv1, ...uv2);
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

// ========== Geometry Creators ==========

function createPlane(width, height, segments = 1) {
    const positions = [];
    const uvs = [];
    
    const hw = width / 2, hh = height / 2;
    const segW = width / segments, segH = height / segments;
    
    for (let j = 0; j < segments; j++) {
        for (let i = 0; i < segments; i++) {
            const x0 = -hw + i * segW, x1 = x0 + segW;
            const y0 = -hh + j * segH, y1 = y0 + segH;
            const u0 = i / segments, u1 = (i + 1) / segments;
            const v0 = j / segments, v1 = (j + 1) / segments;
            
            positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0);
            positions.push(x0, y0, 0, x1, y1, 0, x0, y1, 0);
            uvs.push(u0, v0, u1, v0, u1, v1);
            uvs.push(u0, v0, u1, v1, u0, v1);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

function createCircle(radius, segments = 32) {
    const positions = [];
    const uvs = [];
    
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        
        const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
        const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
        
        positions.push(0, 0, 0, x0, 0, z0, x1, 0, z1);
        uvs.push(0.5, 0.5);
        uvs.push((x0 / radius + 1) / 2, (z0 / radius + 1) / 2);
        uvs.push((x1 / radius + 1) / 2, (z1 / radius + 1) / 2);
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

function createTetrahedron(radius) {
    const a = radius * Math.sqrt(8 / 9);
    const b = radius * Math.sqrt(2 / 9);
    const c = radius * Math.sqrt(2 / 3);
    const d = radius / 3;
    
    const vertices = [
        [0, radius, 0],
        [-c, -d, -b],
        [c, -d, -b],
        [0, -d, a]
    ];
    
    const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]];
    
    const positions = [];
    const uvs = [];
    
    for (const face of faces) {
        for (const idx of face) {
            const v = vertices[idx];
            positions.push(...v);
            uvs.push(...sphericalUV(...v));
        }
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

function createOctahedron(radius) {
    const vertices = [
        [0, radius, 0], [0, -radius, 0],
        [radius, 0, 0], [-radius, 0, 0],
        [0, 0, radius], [0, 0, -radius]
    ];
    
    const faces = [
        [0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
        [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3]
    ];
    
    const positions = [];
    const uvs = [];
    
    for (const face of faces) {
        for (const idx of face) {
            const v = vertices[idx];
            positions.push(...v);
            uvs.push(...sphericalUV(...v));
        }
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

function createTorus(majorRadius, minorRadius, majorSegments = 32, minorSegments = 16) {
    const positions = [];
    const uvs = [];
    
    function torusPoint(theta, phi) {
        const x = (majorRadius + minorRadius * Math.cos(phi)) * Math.cos(theta);
        const y = minorRadius * Math.sin(phi);
        const z = (majorRadius + minorRadius * Math.cos(phi)) * Math.sin(theta);
        return [x, y, z];
    }
    
    for (let j = 0; j < majorSegments; j++) {
        const u0 = j / majorSegments, u1 = (j + 1) / majorSegments;
        const theta0 = u0 * Math.PI * 2, theta1 = u1 * Math.PI * 2;
        
        for (let i = 0; i < minorSegments; i++) {
            const v0 = i / minorSegments, v1 = (i + 1) / minorSegments;
            const phi0 = v0 * Math.PI * 2, phi1 = v1 * Math.PI * 2;
            
            const p00 = torusPoint(theta0, phi0);
            const p10 = torusPoint(theta1, phi0);
            const p01 = torusPoint(theta0, phi1);
            const p11 = torusPoint(theta1, phi1);
            
            positions.push(...p00, ...p10, ...p11);
            positions.push(...p00, ...p11, ...p01);
            uvs.push(u0, v0, u1, v0, u1, v1);
            uvs.push(u0, v0, u1, v1, u0, v1);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        uvs: new Float32Array(uvs),
        vertexCount: positions.length / 3
    };
}

// ========== WebGPU Helper Functions ==========

function makeShaderModule(device, source) {
    return device.createShaderModule({ code: source });
}

function makeVertexBuffer(device, data) {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    return buffer;
}

async function createTextureFromImage(device, src) {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    const imageBitmap = await createImageBitmap(img);

    const texture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | 
               GPUTextureUsage.COPY_DST | 
               GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture: texture },
        [imageBitmap.width, imageBitmap.height, 1]
    );
    
    return texture;
}

// ========== Main Application ==========

async function init() {
    // Initialize WebGPU
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

    const ctx = canvas.getContext("webgpu");
    const format = gpu.getPreferredCanvasFormat();
    ctx.configure({
        device: device,
        format: format,
        alphaMode: "opaque"
    });

    // Create shader modules
    const vShaderModule = makeShaderModule(device, vertexShaderWGSL);
    const fShaderModule = makeShaderModule(device, fragmentShaderWGSL);

    // Create render pipeline
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: vShaderModule,
            entryPoint: "main",
            buffers: [
                {
                    arrayStride: 3 * 4,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x3"
                    }]
                },
                {
                    arrayStride: 2 * 4,
                    attributes: [{
                        shaderLocation: 1,
                        offset: 0,
                        format: "float32x2"
                    }]
                }
            ]
        },
        fragment: {
            module: fShaderModule,
            entryPoint: "main",
            targets: [{ format: format }]
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "none"  // Double-sided rendering
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus-stencil8"
        }
    });

    // Load texture
    const texture = await createTextureFromImage(device, TEXTURE_URL);
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });

    // Load Manifold
    const wasm = await Module();
    wasm.setup();
    const { Manifold } = wasm;

    // Create primitives
    const spacing = 2.5;
    const primitives = [
        // Row 1
        { name: 'Plane', pos: [-spacing, spacing, 0], data: createPlane(1.5, 1.5, 4) },
        { name: 'Cube', pos: [0, spacing, 0], data: (() => {
            const cube = Manifold.cube([1.2, 1.2, 1.2], true);
            const data = manifoldToArrays(cube, boxUV);
            cube.delete();
            return data;
        })() },
        { name: 'Sphere', pos: [spacing, spacing, 0], data: (() => {
            const sphere = Manifold.sphere(0.8, 48);
            const data = manifoldToArrays(sphere, sphericalUV, true);
            sphere.delete();
            return data;
        })() },
        
        // Row 2
        { name: 'Circle', pos: [-spacing, 0, 0], data: createCircle(0.8, 32), rotateX: -Math.PI / 2 },
        { name: 'Cylinder', pos: [0, 0, 0], data: (() => {
            const cyl = Manifold.cylinder(1.2, 0.6, 0.6, 32);
            const data = manifoldToArrays(cyl, (x, y, z) => cylindricalUV(x, y, z, 1.2), true);
            cyl.delete();
            return data;
        })() },
        { name: 'Cone', pos: [spacing, 0, 0], data: (() => {
            const cone = Manifold.cylinder(1.2, 0.7, 0.0, 32);
            const data = manifoldToArrays(cone, (x, y, z) => cylindricalUV(x, y, z, 1.2), true);
            cone.delete();
            return data;
        })() },
        
        // Row 3
        { name: 'Tetra', pos: [-spacing, -spacing, 0], data: createTetrahedron(0.8) },
        { name: 'Octa', pos: [0, -spacing, 0], data: createOctahedron(0.8) },
        { name: 'Torus', pos: [spacing, -spacing, 0], data: createTorus(0.5, 0.25, 32, 16) }
    ];

    // Create mesh data for WebGPU
    const meshes = [];
    
    for (const prim of primitives) {
        const positionBuffer = makeVertexBuffer(device, prim.data.positions);
        const uvBuffer = makeVertexBuffer(device, prim.data.uvs);
        
        // Create uniform buffer for this mesh
        const uniformBuffer = device.createBuffer({
            size: 4 * 16, // 4x4 matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        
        // Create bind group for this mesh
        const bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: texture.createView() }
            ],
        });
        
        meshes.push({
            positionBuffer,
            uvBuffer,
            uniformBuffer,
            bindGroup,
            vertexCount: prim.data.vertexCount,
            position: prim.pos,
            rotateX: prim.rotateX || 0
        });
    }

    // Setup matrices
    const projectionMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const modelMatrix = mat4.create();
    const modelViewProjectionMatrix = mat4.create();

    // Create depth texture
    let depthTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    // Handle resize
    function resize() {
        canvas.width = window.innerWidth * devicePixelRatio;
        canvas.height = window.innerHeight * devicePixelRatio;
        
        depthTexture.destroy();
        depthTexture = device.createTexture({
            size: { width: canvas.width, height: canvas.height, depthOrArrayLayers: 1 },
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
    }
    window.addEventListener('resize', resize);

    // Render loop
    function render(timestamp) {
        const time = timestamp / 1000;
        
        const aspect = canvas.width / canvas.height;
        mat4.perspective(projectionMatrix, Math.PI / 4, aspect, 0.1, 100);
        mat4.lookAt(viewMatrix, [0, 0, 10], [0, 0, 0], [0, 1, 0]);

        const commandEncoder = device.createCommandEncoder();
        const textureView = ctx.getCurrentTexture().createView();
        
        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                clearValue: { r: 0.0, g: 0.0, b: 0.02, a: 1.0 },
                storeOp: "store"
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: "store",
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: "store"
            }
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);

        // Draw each mesh
        for (const mesh of meshes) {
            // Calculate model-view-projection matrix
            mat4.identity(modelMatrix);
            mat4.translate(modelMatrix, modelMatrix, mesh.position);
            mat4.rotateY(modelMatrix, modelMatrix, time * 0.5);
            if (mesh.rotateX) {
                mat4.rotateX(modelMatrix, modelMatrix, mesh.rotateX);
            }
            
            mat4.multiply(modelViewProjectionMatrix, viewMatrix, modelMatrix);
            mat4.multiply(modelViewProjectionMatrix, projectionMatrix, modelViewProjectionMatrix);
            
            // Update uniform buffer
            device.queue.writeBuffer(mesh.uniformBuffer, 0, modelViewProjectionMatrix);
            
            passEncoder.setVertexBuffer(0, mesh.positionBuffer);
            passEncoder.setVertexBuffer(1, mesh.uvBuffer);
            passEncoder.setBindGroup(0, mesh.bindGroup);
            passEncoder.draw(mesh.vertexCount, 1, 0, 0);
        }

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);
        
        requestAnimationFrame(render);
    }
    
    requestAnimationFrame(render);
}

init();