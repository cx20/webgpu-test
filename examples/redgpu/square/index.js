const BASE_URL = "https://rawcdn.githack.com/redcamel/RedGPU/98de8c12d1f59dd7b50b14b4c8f9fc8399fa8c66/";

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

            redGPU.setSize(window.innerWidth, window.innerHeight);

            // Square data
            //             1.0 y 
            //              ^  -1.0 
            //              | / z
            //              |/       x
            // -1.0 -----------------> +1.0
            //            / |
            //      +1.0 /  |
            //           -1.0
            // 
            //        [0]------[1]
            //         |      / |
            //         |    /   |
            //         |  /     |
            //        [2]------[3]
            //
            let interleaveData = new Float32Array(
                [
                    // x,   y,   z,    r,   g,   b    a
                    -0.5, 0.5, 0.0,  1.0, 0.0, 0.0, 1.0, // v0
                     0.5, 0.5, 0.0,  0.0, 1.0, 0.0, 1.0, // v1
                    -0.5,-0.5, 0.0,  0.0, 0.0, 1.0, 1.0, // v2
                     0.5,-0.5, 0.0,  1.0, 1.0, 0.0, 1.0  // v3
                ]
            );
            let indexData = new Uint16Array(
                [
                    2, 1, 0, // v2-v1-v0
                    2, 3, 1  // v2-v3-v1
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

            let colorMat = new VertexColorMaterial(redGPU);
            let tMesh = new RedMesh(redGPU, geometry, colorMat);
            tScene.addChild(tMesh);

            let renderer = new RedRender();
            let render = function (time) {
                renderer.render(time, redGPU);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
        }
    );

})();
