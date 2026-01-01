const { mat4, mat3, vec3, quat } = glMatrix;

// Maximum joints supported by the skinning shader
const MAX_JOINTS = 180;

// Model configurations
const modelInfoSet = [
    {
        name: "CesiumMilkTruck",
        scale: 0.4,
        rotation: [0, Math.PI / 2, 0],
        position: [0, 0, -2],
        url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"
    }, {
        name: "Fox",
        scale: 0.05,
        rotation: [0, Math.PI / 2, 0],
        position: [0, 0, 0],
        url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"
    }, {
        name: "Rex",
        scale: 1.0,
        rotation: [0, Math.PI / 2, 0],
        position: [0, 0, 3],
        url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf"
    }
];

// ========== glTF/GLB Loader ==========

async function loadGLTF(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
    
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    const isGLB = url.endsWith('.glb');
    
    if (isGLB) {
        const buffer = await response.arrayBuffer();
        return parseGLB(buffer, baseUrl);
    } else {
        const gltf = await response.json();
        return parseGLTF(gltf, baseUrl);
    }
}

async function parseGLTF(gltf, baseUrl) {
    const buffers = [];
    if (gltf.buffers) {
        for (const buffer of gltf.buffers) {
            if (buffer.uri) {
                const bufferUrl = new URL(buffer.uri, baseUrl).href;
                const response = await fetch(bufferUrl);
                const arrayBuffer = await response.arrayBuffer();
                buffers.push(new Uint8Array(arrayBuffer));
            }
        }
    }
    return { gltf, buffers, baseUrl };
}

function parseGLB(buffer, baseUrl) {
    const dataView = new DataView(buffer);
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546C67) throw new Error('Invalid GLB file');
    
    const length = dataView.getUint32(8, true);
    let offset = 12;
    
    const jsonChunkLength = dataView.getUint32(offset, true);
    offset += 8;
    const jsonData = new Uint8Array(buffer, offset, jsonChunkLength);
    const gltf = JSON.parse(new TextDecoder().decode(jsonData));
    offset += jsonChunkLength;
    
    const buffers = [];
    if (offset < length) {
        const binChunkLength = dataView.getUint32(offset, true);
        offset += 8;
        buffers.push(new Uint8Array(buffer, offset, binChunkLength));
    }
    
    return { gltf, buffers, baseUrl };
}

function getAccessorData(gltf, buffers, accessorIndex) {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const bufferIndex = bufferView.buffer || 0;
    const binData = buffers[bufferIndex];
    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const count = accessor.count;
    
    const componentTypes = {
        5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
        5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array
    };
    const numComponents = { 'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16 };
    
    const TypedArray = componentTypes[accessor.componentType];
    const components = numComponents[accessor.type];
    const byteStride = bufferView.byteStride || 0;
    
    if (byteStride && byteStride !== components * TypedArray.BYTES_PER_ELEMENT) {
        const result = new TypedArray(count * components);
        const elementSize = TypedArray.BYTES_PER_ELEMENT;
        for (let i = 0; i < count; i++) {
            const srcOffset = byteOffset + i * byteStride;
            for (let j = 0; j < components; j++) {
                const view = new DataView(binData.buffer, binData.byteOffset + srcOffset + j * elementSize, elementSize);
                if (TypedArray === Float32Array) result[i * components + j] = view.getFloat32(0, true);
                else if (TypedArray === Uint16Array) result[i * components + j] = view.getUint16(0, true);
                else if (TypedArray === Uint32Array) result[i * components + j] = view.getUint32(0, true);
                else if (TypedArray === Uint8Array) result[i * components + j] = view.getUint8(0);
            }
        }
        return result;
    }
    return new TypedArray(binData.buffer, binData.byteOffset + byteOffset, count * components);
}

// ========== Texture Loading ==========

async function loadTextureFromGLTF(device, gltf, buffers, baseUrl, textureIndex) {
    const textureInfo = gltf.textures[textureIndex];
    const image = gltf.images[textureInfo.source];
    
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    
    await new Promise((resolve) => {
        img.onload = resolve;
        if (image.uri) {
            img.src = new URL(image.uri, baseUrl).href;
        } else if (image.bufferView !== undefined) {
            const bufferView = gltf.bufferViews[image.bufferView];
            const binData = buffers[bufferView.buffer || 0];
            const byteOffset = bufferView.byteOffset || 0;
            const blob = new Blob(
                [new Uint8Array(binData.buffer, binData.byteOffset + byteOffset, bufferView.byteLength)],
                { type: image.mimeType }
            );
            img.src = URL.createObjectURL(blob);
        }
    });
    
    const imageBitmap = await createImageBitmap(img);
    
    const texture = device.createTexture({
        size: [imageBitmap.width, imageBitmap.height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    device.queue.copyExternalImageToTexture(
        { source: imageBitmap },
        { texture },
        [imageBitmap.width, imageBitmap.height]
    );
    
    return texture;
}

async function loadCubeMap(device, urls) {
    const images = await Promise.all(urls.map(async (url) => {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.src = url;
        await img.decode();
        return createImageBitmap(img);
    }));
    
    const size = images[0].width;
    
    const texture = device.createTexture({
        size: [size, size, 6],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        dimension: '2d'
    });
    
    for (let i = 0; i < 6; i++) {
        device.queue.copyExternalImageToTexture(
            { source: images[i] },
            { texture, origin: [0, 0, i] },
            [size, size]
        );
    }
    
    return texture;
}

// ========== Mesh Processing ==========

function calculateBoundingBox(positions) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
        min[0] = Math.min(min[0], positions[i]);
        min[1] = Math.min(min[1], positions[i + 1]);
        min[2] = Math.min(min[2], positions[i + 2]);
        max[0] = Math.max(max[0], positions[i]);
        max[1] = Math.max(max[1], positions[i + 1]);
        max[2] = Math.max(max[2], positions[i + 2]);
    }
    return { min, max };
}

function mergeBoundingBoxes(a, b) {
    return {
        min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
        max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])]
    };
}

async function processMesh(device, gltf, buffers, baseUrl, meshIndex, defaultTexture, sampler, mainPipeline, mainPipelineLayout) {
    const mesh = gltf.meshes[meshIndex];
    const primitives = [];
    
    for (const primitive of mesh.primitives) {
        const attrs = primitive.attributes;
        
        // Get attribute data
        const positions = getAccessorData(gltf, buffers, attrs.POSITION);
        const normals = attrs.NORMAL !== undefined ? getAccessorData(gltf, buffers, attrs.NORMAL) : null;
        const texCoords = attrs.TEXCOORD_0 !== undefined ? getAccessorData(gltf, buffers, attrs.TEXCOORD_0) : null;
        const joints = attrs.JOINTS_0 !== undefined ? getAccessorData(gltf, buffers, attrs.JOINTS_0) : null;
        const weights = attrs.WEIGHTS_0 !== undefined ? getAccessorData(gltf, buffers, attrs.WEIGHTS_0) : null;
        
        const vertexCount = positions.length / 3;
        
        // Generate default data if missing
        const finalNormals = normals || new Float32Array(vertexCount * 3).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0);
        const finalTexCoords = texCoords || new Float32Array(vertexCount * 2);
        
        // Convert joints to Uint32Array for WebGPU (uint32x4 format)
        let finalJoints;
        if (joints) {
            finalJoints = new Uint32Array(vertexCount * 4);
            for (let i = 0; i < joints.length; i++) {
                finalJoints[i] = joints[i];
            }
        } else {
            finalJoints = new Uint32Array(vertexCount * 4);
        }
        
        const finalWeights = weights || new Float32Array(vertexCount * 4).map((_, i) => i % 4 === 0 ? 1 : 0);
        
        // Create buffers
        const positionBuffer = device.createBuffer({
            size: positions.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(positionBuffer.getMappedRange()).set(positions);
        positionBuffer.unmap();
        
        const normalBuffer = device.createBuffer({
            size: finalNormals.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(normalBuffer.getMappedRange()).set(finalNormals);
        normalBuffer.unmap();
        
        const texCoordBuffer = device.createBuffer({
            size: finalTexCoords.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(texCoordBuffer.getMappedRange()).set(finalTexCoords);
        texCoordBuffer.unmap();
        
        const jointsBuffer = device.createBuffer({
            size: finalJoints.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Uint32Array(jointsBuffer.getMappedRange()).set(finalJoints);
        jointsBuffer.unmap();
        
        const weightsBuffer = device.createBuffer({
            size: finalWeights.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        });
        new Float32Array(weightsBuffer.getMappedRange()).set(finalWeights);
        weightsBuffer.unmap();
        
        // Index buffer
        let indexBuffer = null;
        let indexCount = vertexCount;
        let indexFormat = 'uint16';
        
        if (primitive.indices !== undefined) {
            const indices = getAccessorData(gltf, buffers, primitive.indices);
            const indexAccessor = gltf.accessors[primitive.indices];
            
            // WebGPU only supports uint16 and uint32
            let indexData;
            if (indexAccessor.componentType === 5123) { // UNSIGNED_SHORT
                indexData = indices;
                indexFormat = 'uint16';
            } else if (indexAccessor.componentType === 5125) { // UNSIGNED_INT
                indexData = indices;
                indexFormat = 'uint32';
            } else { // UNSIGNED_BYTE - convert to uint16
                indexData = new Uint16Array(indices.length);
                for (let i = 0; i < indices.length; i++) indexData[i] = indices[i];
                indexFormat = 'uint16';
            }
            
            // Ensure proper alignment (4 bytes for uint32, can be 2 for uint16)
            const bufferSize = indexFormat === 'uint32' 
                ? Math.ceil(indexData.byteLength / 4) * 4 
                : Math.ceil(indexData.byteLength / 4) * 4;
            
            indexBuffer = device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.INDEX,
                mappedAtCreation: true
            });
            
            if (indexFormat === 'uint32') {
                new Uint32Array(indexBuffer.getMappedRange()).set(indexData);
            } else {
                new Uint16Array(indexBuffer.getMappedRange()).set(indexData);
            }
            indexBuffer.unmap();
            indexCount = indices.length;
        }
        
        // Load texture
        let texture = defaultTexture;
        let baseColor = [1, 1, 1, 1];
        let hasTexture = false;
        
        if (primitive.material !== undefined) {
            const material = gltf.materials[primitive.material];
            if (material.pbrMetallicRoughness) {
                const pbr = material.pbrMetallicRoughness;
                if (pbr.baseColorTexture) {
                    texture = await loadTextureFromGLTF(device, gltf, buffers, baseUrl, pbr.baseColorTexture.index);
                    hasTexture = true;
                }
                if (pbr.baseColorFactor) {
                    baseColor = pbr.baseColorFactor;
                }
            }
        }
        
        const hasSkinning = joints !== null && weights !== null;
        const bbox = calculateBoundingBox(positions);
        
        // Create uniform buffer for this primitive
        const uniformBufferSize = 304; // Aligned uniforms
        const uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        
        // Create joint matrices storage buffer
        const jointMatricesBuffer = device.createBuffer({
            size: MAX_JOINTS * 64, // 180 * mat4x4
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        
        // Create bind group
        const bindGroup = device.createBindGroup({
            layout: mainPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: { buffer: jointMatricesBuffer } },
                { binding: 2, resource: sampler },
                { binding: 3, resource: texture.createView() }
            ]
        });
        
        primitives.push({
            positionBuffer,
            normalBuffer,
            texCoordBuffer,
            jointsBuffer,
            weightsBuffer,
            indexBuffer,
            indexCount,
            indexFormat,
            hasIndices: primitive.indices !== undefined,
            uniformBuffer,
            jointMatricesBuffer,
            bindGroup,
            baseColor,
            hasTexture,
            hasSkinning,
            bbox
        });
    }
    
    let combinedBbox = primitives[0].bbox;
    for (let i = 1; i < primitives.length; i++) {
        combinedBbox = mergeBoundingBoxes(combinedBbox, primitives[i].bbox);
    }
    
    return { primitives, bbox: combinedBbox };
}

// ========== Skinning ==========

function loadSkins(gltf, buffers) {
    if (!gltf.skins) return [];
    
    return gltf.skins.map(skin => {
        const inverseBindMatrices = skin.inverseBindMatrices !== undefined
            ? getAccessorData(gltf, buffers, skin.inverseBindMatrices)
            : null;
        
        const matrices = [];
        if (inverseBindMatrices) {
            for (let i = 0; i < skin.joints.length; i++) {
                matrices.push(mat4.clone(inverseBindMatrices.subarray(i * 16, i * 16 + 16)));
            }
        } else {
            for (let i = 0; i < skin.joints.length; i++) {
                matrices.push(mat4.create());
            }
        }
        
        return {
            joints: skin.joints,
            inverseBindMatrices: matrices,
            jointMatrices: skin.joints.map(() => mat4.create())
        };
    });
}

function updateSkinMatrices(skin, nodes) {
    for (let i = 0; i < skin.joints.length; i++) {
        const jointNode = nodes[skin.joints[i]];
        mat4.multiply(skin.jointMatrices[i], jointNode.worldMatrix, skin.inverseBindMatrices[i]);
    }
}

// ========== Animation ==========

function loadAnimations(gltf, buffers) {
    if (!gltf.animations) return [];
    
    return gltf.animations.map(anim => {
        const channels = anim.channels.map(channel => {
            const sampler = anim.samplers[channel.sampler];
            return {
                targetNode: channel.target.node,
                targetPath: channel.target.path,
                input: getAccessorData(gltf, buffers, sampler.input),
                output: getAccessorData(gltf, buffers, sampler.output),
                interpolation: sampler.interpolation || 'LINEAR'
            };
        });
        
        let maxTime = 0;
        channels.forEach(ch => {
            if (ch.input.length > 0) {
                maxTime = Math.max(maxTime, ch.input[ch.input.length - 1]);
            }
        });
        
        return { name: anim.name, channels, duration: maxTime };
    });
}

function updateAnimation(animation, nodes, time) {
    const t = time % animation.duration;
    
    animation.channels.forEach(channel => {
        const node = nodes[channel.targetNode];
        const times = channel.input;
        const values = channel.output;
        
        let prevIndex = 0;
        let nextIndex = 0;
        
        for (let i = 0; i < times.length - 1; i++) {
            if (t >= times[i] && t < times[i + 1]) {
                prevIndex = i;
                nextIndex = i + 1;
                break;
            }
        }
        
        const startTime = times[prevIndex];
        const endTime = times[nextIndex];
        const factor = (t - startTime) / (endTime - startTime);
        
        if (channel.targetPath === 'rotation') {
            const prev = values.subarray(prevIndex * 4, prevIndex * 4 + 4);
            const next = values.subarray(nextIndex * 4, nextIndex * 4 + 4);
            quat.slerp(node.rotation, prev, next, factor);
        } else if (channel.targetPath === 'translation') {
            const prev = values.subarray(prevIndex * 3, prevIndex * 3 + 3);
            const next = values.subarray(nextIndex * 3, nextIndex * 3 + 3);
            vec3.lerp(node.translation, prev, next, factor);
        } else if (channel.targetPath === 'scale') {
            const prev = values.subarray(prevIndex * 3, prevIndex * 3 + 3);
            const next = values.subarray(nextIndex * 3, nextIndex * 3 + 3);
            vec3.lerp(node.scale, prev, next, factor);
        }
    });
}

// ========== Main ==========

async function main() {
    // Initialize WebGPU
    const gpu = navigator.gpu;
    if (!gpu) {
        alert('WebGPU is not supported');
        return;
    }
    
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();
    
    const canvas = document.getElementById('c');
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    
    const ctx = canvas.getContext('webgpu');
    const format = gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    
    // Create depth texture
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth * devicePixelRatio;
        canvas.height = window.innerHeight * devicePixelRatio;
        depthTexture.destroy();
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
    });
    
    // Create shaders
    const vsSource = document.getElementById('vs').textContent;
    const fsSource = document.getElementById('fs').textContent;
    const vsSkyboxSource = document.getElementById('vs-skybox').textContent;
    const fsSkyboxSource = document.getElementById('fs-skybox').textContent;
    
    // Create sampler
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        mipmapFilter: 'linear'
    });
    
    // Create default white texture
    const defaultTexture = device.createTexture({
        size: [1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture(
        { texture: defaultTexture },
        new Uint8Array([255, 255, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1]
    );
    
    // Main pipeline layout
    const mainBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} }
        ]
    });
    
    const mainPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [mainBindGroupLayout]
    });
    
    // Main render pipeline
    const mainPipeline = device.createRenderPipeline({
        layout: mainPipelineLayout,
        vertex: {
            module: device.createShaderModule({ code: vsSource }),
            entryPoint: 'main',
            buffers: [
                { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                { arrayStride: 8, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
                { arrayStride: 16, attributes: [{ shaderLocation: 3, offset: 0, format: 'uint32x4' }] },
                { arrayStride: 16, attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x4' }] }
            ]
        },
        fragment: {
            module: device.createShaderModule({ code: fsSource }),
            entryPoint: 'main',
            targets: [{ format }]
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { depthWriteEnabled: true, depthCompare: 'less', format: 'depth24plus' }
    });
    
    // Skybox pipeline
    const skyboxBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
            { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: 'cube' } }
        ]
    });
    
    const skyboxPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [skyboxBindGroupLayout]
    });
    
    const skyboxPipeline = device.createRenderPipeline({
        layout: skyboxPipelineLayout,
        vertex: {
            module: device.createShaderModule({ code: vsSkyboxSource }),
            entryPoint: 'main',
            buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] }]
        },
        fragment: {
            module: device.createShaderModule({ code: fsSkyboxSource }),
            entryPoint: 'main',
            targets: [{ format }]
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: { depthWriteEnabled: false, depthCompare: 'less-equal', format: 'depth24plus' }
    });
    
    // Create skybox geometry
    const skyboxVertices = new Float32Array([
        -1,  1, -1, -1, -1, -1,  1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,
        -1, -1,  1, -1, -1, -1, -1,  1, -1, -1,  1, -1, -1,  1,  1, -1, -1,  1,
         1, -1, -1,  1, -1,  1,  1,  1,  1,  1,  1,  1,  1,  1, -1,  1, -1, -1,
        -1, -1,  1, -1,  1,  1,  1,  1,  1,  1,  1,  1,  1, -1,  1, -1, -1,  1,
        -1,  1, -1,  1,  1, -1,  1,  1,  1,  1,  1,  1, -1,  1,  1, -1,  1, -1,
        -1, -1, -1, -1, -1,  1,  1, -1, -1,  1, -1, -1, -1, -1,  1,  1, -1,  1
    ]);
    
    const skyboxBuffer = device.createBuffer({
        size: skyboxVertices.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true
    });
    new Float32Array(skyboxBuffer.getMappedRange()).set(skyboxVertices);
    skyboxBuffer.unmap();
    
    const skyboxUniformBuffer = device.createBuffer({
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Load skybox texture
    const skyboxPath = 'https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/';
    const skyboxUrls = ['px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'].map(f => skyboxPath + f);
    const skyboxTexture = await loadCubeMap(device, skyboxUrls);
    
    const skyboxBindGroup = device.createBindGroup({
        layout: skyboxBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: skyboxUniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: skyboxTexture.createView({ dimension: 'cube' }) }
        ]
    });
    
    // Load models
    const loadedModels = [];
    let sceneBbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    
    for (const modelInfo of modelInfoSet) {
        console.log(`Loading ${modelInfo.name}...`);
        const { gltf, buffers, baseUrl } = await loadGLTF(modelInfo.url);
        
        const nodes = gltf.nodes.map((node, index) => {
            const nodeData = {
                translation: node.translation ? vec3.clone(node.translation) : vec3.fromValues(0, 0, 0),
                rotation: node.rotation ? quat.clone(node.rotation) : quat.fromValues(0, 0, 0, 1),
                scale: node.scale ? vec3.clone(node.scale) : vec3.fromValues(1, 1, 1),
                matrix: mat4.create(),
                worldMatrix: mat4.create(),
                meshIndex: node.mesh,
                skinIndex: node.skin !== undefined ? node.skin : null,
                children: node.children || [],
                hasMatrix: !!node.matrix,
                name: node.name || `Node_${index}`
            };
            // If node has a matrix property, use it to initialize TRS
            if (node.matrix) {
                mat4.copy(nodeData.matrix, node.matrix);
                mat4.getTranslation(nodeData.translation, nodeData.matrix);
                mat4.getRotation(nodeData.rotation, nodeData.matrix);
                mat4.getScaling(nodeData.scale, nodeData.matrix);
            }
            return nodeData;
        });
        

        const meshes = [];
        if (gltf.meshes) {
            for (let i = 0; i < gltf.meshes.length; i++) {
                const mesh = await processMesh(device, gltf, buffers, baseUrl, i, defaultTexture, sampler, mainPipeline, mainPipelineLayout);
                meshes.push(mesh);
            }
        }
        
        const skins = loadSkins(gltf, buffers);
        const animations = loadAnimations(gltf, buffers);
        
        let currentAnimation = null;
        if (animations.length > 0 && modelInfo.name !== 'CesiumMilkTruck') {
            currentAnimation = modelInfo.name === 'Fox' 
                ? (animations.find(a => a.name === 'Run') || animations[0])
                : animations[0];
        }
        
        const scene = gltf.scenes[gltf.scene || 0];
        
        const baseTransform = mat4.create();
        mat4.translate(baseTransform, baseTransform, modelInfo.position);
        mat4.rotateY(baseTransform, baseTransform, modelInfo.rotation[1]);
        mat4.rotateX(baseTransform, baseTransform, modelInfo.rotation[0]);
        mat4.rotateZ(baseTransform, baseTransform, modelInfo.rotation[2]);
        mat4.scale(baseTransform, baseTransform, [modelInfo.scale, modelInfo.scale, modelInfo.scale]);
        
        loadedModels.push({
            nodes, meshes, skins, animations, currentAnimation,
            rootNodes: scene.nodes, baseTransform
        });
        
        // Update scene bounding box
        for (const nodeIndex of scene.nodes) {
            function traverseBBox(idx, parentMat) {
                const node = nodes[idx];
                const localMat = mat4.create();
                mat4.fromRotationTranslationScale(localMat, node.rotation, node.translation, node.scale);
                const worldMat = mat4.create();
                mat4.multiply(worldMat, parentMat, localMat);
                
                if (node.meshIndex !== undefined) {
                    const mesh = meshes[node.meshIndex];
                    const corners = [
                        [mesh.bbox.min[0], mesh.bbox.min[1], mesh.bbox.min[2]],
                        [mesh.bbox.max[0], mesh.bbox.min[1], mesh.bbox.min[2]],
                        [mesh.bbox.min[0], mesh.bbox.max[1], mesh.bbox.min[2]],
                        [mesh.bbox.max[0], mesh.bbox.max[1], mesh.bbox.min[2]],
                        [mesh.bbox.min[0], mesh.bbox.min[1], mesh.bbox.max[2]],
                        [mesh.bbox.max[0], mesh.bbox.min[1], mesh.bbox.max[2]],
                        [mesh.bbox.min[0], mesh.bbox.max[1], mesh.bbox.max[2]],
                        [mesh.bbox.max[0], mesh.bbox.max[1], mesh.bbox.max[2]]
                    ];
                    for (const corner of corners) {
                        const t = vec3.transformMat4(vec3.create(), corner, worldMat);
                        sceneBbox.min[0] = Math.min(sceneBbox.min[0], t[0]);
                        sceneBbox.min[1] = Math.min(sceneBbox.min[1], t[1]);
                        sceneBbox.min[2] = Math.min(sceneBbox.min[2], t[2]);
                        sceneBbox.max[0] = Math.max(sceneBbox.max[0], t[0]);
                        sceneBbox.max[1] = Math.max(sceneBbox.max[1], t[1]);
                        sceneBbox.max[2] = Math.max(sceneBbox.max[2], t[2]);
                    }
                }
                for (const childId of node.children) traverseBBox(childId, worldMat);
            }
            traverseBBox(nodeIndex, baseTransform);
        }
        
        console.log(`Loaded ${modelInfo.name}`);
    }
    
    // Calculate camera parameters
    const center = [
        (sceneBbox.min[0] + sceneBbox.max[0]) / 2,
        (sceneBbox.min[1] + sceneBbox.max[1]) / 2,
        (sceneBbox.min[2] + sceneBbox.max[2]) / 2
    ];
    const size = [
        sceneBbox.max[0] - sceneBbox.min[0],
        sceneBbox.max[1] - sceneBbox.min[1],
        sceneBbox.max[2] - sceneBbox.min[2]
    ];
    const maxSize = Math.max(size[0], size[1], size[2]);
    const cameraDistance = maxSize * 1.5;
    
    const projectionMatrix = mat4.create();
    const viewMatrix = mat4.create();
    const normalMatrix = mat4.create();
    
    const startTime = performance.now() / 1000;
    
    // Render loop
    function render() {
        const time = performance.now() / 1000 - startTime;
        
        const aspect = canvas.width / canvas.height;
        mat4.perspective(projectionMatrix, Math.PI / 4, aspect, cameraDistance * 0.01, cameraDistance * 10);
        
        const cameraX = center[0] - Math.sin(time * 0.5) * cameraDistance;
        const cameraY = center[1] + cameraDistance * 0.3;
        const cameraZ = center[2] + Math.cos(time * 0.5) * cameraDistance;
        mat4.lookAt(viewMatrix, [cameraX, cameraY, cameraZ], center, [0, 1, 0]);
        
        const commandEncoder = device.createCommandEncoder();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: ctx.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1.0 },
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        
        // Draw skybox
        const skyboxView = mat4.clone(viewMatrix);
        skyboxView[12] = 0; skyboxView[13] = 0; skyboxView[14] = 0;
        
        const skyboxUniforms = new Float32Array(32);
        skyboxUniforms.set(projectionMatrix, 0);
        skyboxUniforms.set(skyboxView, 16);
        device.queue.writeBuffer(skyboxUniformBuffer, 0, skyboxUniforms);
        
        renderPass.setPipeline(skyboxPipeline);
        renderPass.setBindGroup(0, skyboxBindGroup);
        renderPass.setVertexBuffer(0, skyboxBuffer);
        renderPass.draw(36);
        
        // Draw models
        renderPass.setPipeline(mainPipeline);
        
        for (const model of loadedModels) {
            if (model.currentAnimation) {
                updateAnimation(model.currentAnimation, model.nodes, time);
            }
            
            // Update hierarchy to compute world matrices
            const updateHierarchy = (nodeIndex, parentMatrix) => {
                const node = model.nodes[nodeIndex];
                // Only update matrix from TRS if node doesn't have original matrix or has been animated
                if (!node.hasMatrix || model.currentAnimation) {
                    mat4.fromRotationTranslationScale(node.matrix, node.rotation, node.translation, node.scale);
                }
                mat4.multiply(node.worldMatrix, parentMatrix, node.matrix);
                for (const childId of node.children) {
                    updateHierarchy(childId, node.worldMatrix);
                }
            };
            
            for (const rootNodeId of model.rootNodes) {
                updateHierarchy(rootNodeId, model.baseTransform);
            }
            
            // Update skin matrices after hierarchy
            for (const skin of model.skins) {
                updateSkinMatrices(skin, model.nodes);
            }
            
            // Draw meshes
            const drawNode = (nodeIndex) => {
                const node = model.nodes[nodeIndex];
                
                if (node.meshIndex !== undefined) {
                    const nodeSkin = node.skinIndex !== null ? model.skins[node.skinIndex] : null;
                    const mesh = model.meshes[node.meshIndex];
                    
                    const hasSkinning = mesh.primitives.some(p => p.hasSkinning);
                    const modelMatrix = hasSkinning ? mat4.create() : node.worldMatrix;
                    
                    mat4.invert(normalMatrix, modelMatrix);
                    mat4.transpose(normalMatrix, normalMatrix);
                    
                    for (const prim of mesh.primitives) {
                        // Update uniforms
                        const uniforms = new ArrayBuffer(304);
                        const floatView = new Float32Array(uniforms);
                        const uintView = new Uint32Array(uniforms);
                        
                        floatView.set(modelMatrix, 0);
                        floatView.set(viewMatrix, 16);
                        floatView.set(projectionMatrix, 32);
                        floatView.set(normalMatrix, 48);
                        floatView.set([1, 1, 1, 0], 64); // lightDir
                        floatView.set(prim.baseColor, 68); // baseColor
                        uintView[72] = prim.hasSkinning && nodeSkin ? 1 : 0; // hasSkinning
                        uintView[73] = prim.hasTexture ? 1 : 0; // hasTexture
                        
                        device.queue.writeBuffer(prim.uniformBuffer, 0, uniforms);
                        
                        // Update joint matrices
                        if (prim.hasSkinning && nodeSkin) {
                            const jointData = new Float32Array(MAX_JOINTS * 16);
                            const numJoints = Math.min(nodeSkin.jointMatrices.length, MAX_JOINTS);
                            for (let j = 0; j < numJoints; j++) {
                                jointData.set(nodeSkin.jointMatrices[j], j * 16);
                            }
                            device.queue.writeBuffer(prim.jointMatricesBuffer, 0, jointData);
                        }
                        
                        renderPass.setBindGroup(0, prim.bindGroup);
                        renderPass.setVertexBuffer(0, prim.positionBuffer);
                        renderPass.setVertexBuffer(1, prim.normalBuffer);
                        renderPass.setVertexBuffer(2, prim.texCoordBuffer);
                        renderPass.setVertexBuffer(3, prim.jointsBuffer);
                        renderPass.setVertexBuffer(4, prim.weightsBuffer);
                        
                        if (prim.hasIndices) {
                            renderPass.setIndexBuffer(prim.indexBuffer, prim.indexFormat);
                            renderPass.drawIndexed(prim.indexCount);
                        } else {
                            renderPass.draw(prim.indexCount);
                        }
                    }
                }
                
                for (const childId of node.children) {
                    drawNode(childId);
                }
            };
            
            for (const rootNodeId of model.rootNodes) {
                drawNode(rootNodeId);
            }
        }
        
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        
        requestAnimationFrame(render);
    }
    
    render();
}

main();