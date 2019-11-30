import RedGPU from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedGPU.js";
import RedBuffer from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/buffer/RedBuffer.js";
import RedGeometry from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/geometry/RedGeometry.js";
import RedInterleaveInfo from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/geometry/RedInterleaveInfo.js";
import RedMesh from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/object3D/RedMesh.js";
import RedRender from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/renderer/RedRender.js";
import RedScene from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedScene.js";
import RedView from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/RedView.js";
import RedObitController from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/controller/RedObitController.js";
import RedBaseMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/base/RedBaseMaterial.js";
import RedShareGLSL from "https://rawcdn.githack.com/redcamel/RedGPU/8dfcd2029c13b885b0ac52080d5541daf9c4189d/src/base/RedShareGLSL.js";

class VertexColorMaterial extends RedBaseMaterial {
    static vertexShaderGLSL = `
    #version 460
    ${RedShareGLSL.GLSL_SystemUniforms_vertex.systemUniforms}
    layout(set=2,binding = 0) uniform Uniforms {
        mat4 modelMatrix;
    } uniforms;
    layout(location = 0) in vec3 position;
    layout(location = 1) in vec4 vertexColor;
    layout(location = 0) out vec4 vVertexColor;

    void main() {
        gl_Position = systemUniforms.perspectiveMTX * systemUniforms.cameraMTX * uniforms.modelMatrix* vec4(position,1.0);
        vVertexColor = vertexColor;
    }
    `;
    static fragmentShaderGLSL = `
    #version 460
    layout(location = 0) in vec4 vVertexColor;
    layout(location = 0) out vec4 outColor;
    void main() {
        outColor = vVertexColor;
    }
    `;
    static PROGRAM_OPTION_LIST = [];
    static uniformsBindGroupLayoutDescriptor_material = {
        bindings: [

        ]
    };
    static uniformBufferDescriptor_vertex = RedBaseMaterial.uniformBufferDescriptor_empty;
    static uniformBufferDescriptor_fragment = RedBaseMaterial.uniformBufferDescriptor_empty;

    constructor(redGPU) {
        super(redGPU);
        this.resetBindingInfo()
    }
    resetBindingInfo() {
        this.bindings = [

        ];
        this._afterResetBindingInfo();
    }
}

(async function () {
    const c = document.getElementById('canvas');
    const glslangModule = await import(/* webpackIgnore: true */ 'https://unpkg.com/@webgpu/glslang@0.0.9/dist/web-devel/glslang.js');

    const glslang = await glslangModule.default();
    let redGPU = new RedGPU(c, glslang,
        function () {

            let tScene = new RedScene();
            tScene.backgroundColor = '#fff';
            
            let tCamera = new RedObitController(this);
            let tView = new RedView(this, tScene, tCamera);
            redGPU.addView(tView);
            tCamera.distance = 2;

            redGPU.view = tView
            redGPU.setSize(window.innerWidth, window.innerHeight);

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
            let interleaveData = new Float32Array(
                [
                    // x,   y,   z,    r,   g,   b,  a

                    // Front face
                    -0.5, -0.5,  0.5,  1.0, 0.0, 0.0, 1.0, // v0
                     0.5, -0.5,  0.5,  1.0, 0.0, 0.0, 1.0, // v1
                     0.5,  0.5,  0.5,  1.0, 0.0, 0.0, 1.0, // v2
                    -0.5,  0.5,  0.5,  1.0, 0.0, 0.0, 1.0, // v3
                    // Back face
                    -0.5, -0.5, -0.5,  1.0, 1.0, 0.0, 1.0, // v4
                     0.5, -0.5, -0.5,  1.0, 1.0, 0.0, 1.0, // v5
                     0.5,  0.5, -0.5,  1.0, 1.0, 0.0, 1.0, // v6
                    -0.5,  0.5, -0.5,  1.0, 1.0, 0.0, 1.0, // v7
                    // Top face
                     0.5,  0.5,  0.5,  0.0, 1.0, 0.0, 1.0, // v2
                    -0.5,  0.5,  0.5,  0.0, 1.0, 0.0, 1.0, // v3
                    -0.5,  0.5, -0.5,  0.0, 1.0, 0.0, 1.0, // v7
                     0.5,  0.5, -0.5,  0.0, 1.0, 0.0, 1.0, // v6
                    // Bottom face
                    -0.5, -0.5,  0.5,  1.0, 0.5, 0.5, 1.0, // v0
                     0.5, -0.5,  0.5,  1.0, 0.5, 0.5, 1.0, // v1
                     0.5, -0.5, -0.5,  1.0, 0.5, 0.5, 1.0, // v5
                    -0.5, -0.5, -0.5,  1.0, 0.5, 0.5, 1.0, // v4
                     // Right face
                     0.5, -0.5,  0.5,  1.0, 0.0, 1.0, 1.0, // v1
                     0.5,  0.5,  0.5,  1.0, 0.0, 1.0, 1.0, // v2
                     0.5,  0.5, -0.5,  1.0, 0.0, 1.0, 1.0, // v6
                     0.5, -0.5, -0.5,  1.0, 0.0, 1.0, 1.0, // v5
                     // Left face
                    -0.5, -0.5,  0.5,  0.0, 0.0, 1.0, 1.0, // v0
                    -0.5,  0.5,  0.5,  0.0, 0.0, 1.0, 1.0, // v3
                    -0.5,  0.5, -0.5,  0.0, 0.0, 1.0, 1.0, // v7
                    -0.5, -0.5, -0.5,  0.0, 0.0, 1.0, 1.0  // v4
                ]
            );
            let indexData = new Uint16Array(
                [
                     0,  1,  2,    0,  2 , 3,  // Front face
                     4,  5,  6,    4,  6 , 7,  // Back face
                     8,  9, 10,    8, 10, 11,  // Top face
                    12, 13, 14,   12, 14, 15,  // Bottom face
                    16, 17, 18,   16, 18, 19,  // Right face
                    20, 21, 22,   20, 22, 23   // Left face
                ]
            );
            
            let geometry = new RedGeometry(
                redGPU,
                new RedBuffer(
                    redGPU,
                    'interleaveBuffer',
                    RedBuffer.TYPE_VERTEX,
                    new Float32Array(interleaveData),
                    [
                        // TODO: Investigate how to set the vertex color
                        new RedInterleaveInfo('vertexPosition', 'float3'),
                        new RedInterleaveInfo('vertexColor', 'float4')
                    ]
                ),
                new RedBuffer(
                    redGPU,
                    'indexBuffer',
                    RedBuffer.TYPE_INDEX,
                    new Uint32Array(indexData)
                )
            );
            let colroMat = new VertexColorMaterial(redGPU);
            let tMesh = new RedMesh(redGPU, geometry, colroMat);
            tMesh.cullMode = 'none';
            tScene.addChild(tMesh);

            let renderer = new RedRender();
            let render = function (time) {
                tMesh.rotationX += 1;
                tMesh.rotationY += 1;
                tMesh.rotationZ += 1;
                renderer.render(time, redGPU, tView);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
        }
    );

})();
