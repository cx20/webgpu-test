// forked from https://github.com/greggman/webgpu-utils/blob/main/examples/cube.js
import { mat4, vec3 } from "wgpu-matrix";
import { makeShaderDataDefinitions, makeStructuredView} from "webgpu-utils";

async function main() {
    const gpu = navigator.gpu;
    const adapter = await gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const canvas = document.querySelector("canvas");
    const context = canvas.getContext("webgpu");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const presentationFormat = gpu.getPreferredCanvasFormat(adapter);
    context.configure({
        device,
        format: presentationFormat,
    });

    const canvasInfo = {
        canvas,
        context,
        presentationFormat,
    };

    const shaderSrc = document.getElementById("shader").textContent;

    function createBuffer(device, data, usage) {
        const buffer = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    // Cube data
    //             1.0 y 
    //              ^  -1.0 
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    // 
    //         [7]------[6]
    //        / |      / |
    //      [3]------[2] |
    //       |  |     |  |
    //       | [4]----|-[5]
    //       |/       |/
    //      [0]------[1]
    //
    const positions = [ 
        // Front face
        -0.5, -0.5,  0.5, // v0
         0.5, -0.5,  0.5, // v1
         0.5,  0.5,  0.5, // v2
        -0.5,  0.5,  0.5, // v3
        // Back face
        -0.5, -0.5, -0.5, // v4
         0.5, -0.5, -0.5, // v5
         0.5,  0.5, -0.5, // v6
        -0.5,  0.5, -0.5, // v7
        // Top face
         0.5,  0.5,  0.5, // v2
        -0.5,  0.5,  0.5, // v3
        -0.5,  0.5, -0.5, // v7
         0.5,  0.5, -0.5, // v6
        // Bottom face
        -0.5, -0.5,  0.5, // v0
         0.5, -0.5,  0.5, // v1
         0.5, -0.5, -0.5, // v5
        -0.5, -0.5, -0.5, // v4
         // Right face
         0.5, -0.5,  0.5, // v1
         0.5,  0.5,  0.5, // v2
         0.5,  0.5, -0.5, // v6
         0.5, -0.5, -0.5, // v5
         // Left face
        -0.5, -0.5,  0.5, // v0
        -0.5,  0.5,  0.5, // v3
        -0.5,  0.5, -0.5, // v7
        -0.5, -0.5, -0.5  // v4
    ];
    const colors = [
        [1.0, 0.0, 0.0, 1.0], // Front face
        [1.0, 1.0, 0.0, 1.0], // Back face
        [0.0, 1.0, 0.0, 1.0], // Top face
        [1.0, 0.5, 0.5, 1.0], // Bottom face
        [1.0, 0.0, 1.0, 1.0], // Right face
        [0.0, 0.0, 1.0, 1.0]  // Left face
    ];
    let unpackedColors = [];
    for (let i in colors) {
        let color = colors[i];
        for (let j=0; j < 4; j++) {
            unpackedColors = unpackedColors.concat(color);
        }
    }
    const indices = [
         0,  1,  2,    0,  2 , 3,  // Front face
         4,  5,  6,    4,  6 , 7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23   // Left face
    ];
  
    const positionBuffer = createBuffer(device, new Float32Array(positions),      GPUBufferUsage.VERTEX);
    const colorBuffer    = createBuffer(device, new Float32Array(unpackedColors), GPUBufferUsage.VERTEX);
    const indicesBuffer  = createBuffer(device, new Uint16Array(indices),         GPUBufferUsage.INDEX);
  
    async function createShaderModule(device, code) {
        device.pushErrorScope("validation");
        const shader = device.createShaderModule({
            code
        });
        const error = await device.popErrorScope();
        if (error) {
            throw new Error(error.message);
        }
        return shader;
    }

    const shaderModule = await createShaderModule(device, shaderSrc);

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: [
                // position
                {
                    arrayStride: 3 * 4, // 3 floats, 4 bytes each
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x3"
                    }, ],
                },
                // color
                {
                    arrayStride: 4 * 4, // 4 floats, 4 bytes each
                    attributes: [{
                        shaderLocation: 1,
                        offset: 0,
                        format: "float32x4"
                    }, ],
                },
            ],
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{
                format: presentationFormat
            }, ],
        },
        primitive: {
            topology: "triangle-list",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
    });

    const defs = makeShaderDataDefinitions(shaderSrc);
    const vsUniformValues = makeStructuredView(defs.uniforms.vsUniforms);

    const vsUniformBuffer = device.createBuffer({
        size: vsUniformValues.arrayBuffer.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{
            binding: 0,
            resource: {
                buffer: vsUniformBuffer
            }
        }, ],
    });

    const renderPassDescriptor = {
        colorAttachments: [{
            // view: undefined, // Assigned later
            // resolveTarget: undefined, // Assigned Later
            clearValue: [1.0, 1.0, 1.0, 1.0],
            loadOp: "clear",
            storeOp: "store",
        }, ],
        depthStencilAttachment: {
            // view: undefined,  // Assigned later
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
        },
    };

    function resizeToDisplaySize(device, canvasInfo) {
        const {
            canvas,
            renderTarget,
            presentationFormat,
            depthTexture,
            sampleCount,
        } = canvasInfo;
        const width = Math.min(device.limits.maxTextureDimension2D, canvas.clientWidth);
        const height = Math.min(device.limits.maxTextureDimension2D, canvas.clientHeight);

        const needResize = !canvasInfo.renderTarget ||
            width !== canvas.width ||
            height !== canvas.height;
        if (needResize) {
            if (renderTarget) {
                renderTarget.destroy();
            }
            if (depthTexture) {
                depthTexture.destroy();
            }

            canvas.width = width;
            canvas.height = height;

            if (sampleCount > 1) {
                const newRenderTarget = device.createTexture({
                    size: [canvas.width, canvas.height],
                    format: presentationFormat,
                    sampleCount,
                    usage: GPUTextureUsage.RENDER_ATTACHMENT,
                });
                canvasInfo.renderTarget = newRenderTarget;
                canvasInfo.renderTargetView = newRenderTarget.createView();
            }

            const newDepthTexture = device.createTexture({
                size: [canvas.width, canvas.height],
                format: "depth24plus",
                sampleCount,
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
            canvasInfo.depthTexture = newDepthTexture;
            canvasInfo.depthTextureView = newDepthTexture.createView();
        }
        return needResize;
    }

    function render(time) {
        time *= 0.001;
        resizeToDisplaySize(device, canvasInfo);

        const projection = mat4.perspective(30 * Math.PI / 180, canvas.clientWidth / canvas.clientHeight, 0.5, 10);
        const eye = [1, 2, -5];
        const target = [0, 0, 0];
        const up = [0, 1, 0];

        const camera = mat4.lookAt(eye, target, up);
        const view = mat4.inverse(camera);
        const viewProjection = mat4.multiply(projection, view);
        const world = mat4.rotationY(time);
        mat4.transpose(mat4.inverse(world), vsUniformValues.views.worldInverseTranspose);
        mat4.multiply(viewProjection, world, vsUniformValues.views.worldViewProjection);

        device.queue.writeBuffer(vsUniformBuffer, 0, vsUniformValues.arrayBuffer);

        const colorTexture = context.getCurrentTexture();
        renderPassDescriptor.colorAttachments[0].view = colorTexture.createView();
        renderPassDescriptor.depthStencilAttachment.view = canvasInfo.depthTextureView;

        const commandEncoder = device.createCommandEncoder();
        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);
        passEncoder.setBindGroup(0, bindGroup);
        passEncoder.setVertexBuffer(0, positionBuffer);
        passEncoder.setVertexBuffer(1, colorBuffer);
        passEncoder.setIndexBuffer(indicesBuffer, "uint16");
        passEncoder.drawIndexed(indices.length);
        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

main();