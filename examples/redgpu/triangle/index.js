// import RedGPU from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/RedGPU.js";
// import RedBuffer from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/buffer/RedBuffer.js";
// import RedGeometry from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/geometry/RedGeometry.js";
// import RedInterleaveInfo from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/geometry/RedInterleaveInfo.js";
// import RedMesh from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/object3D/RedMesh.js";
// import RedRender from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/renderer/RedRender.js";
// import RedScene from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/RedScene.js";
// import RedView from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/RedView.js";
// import RedObitController from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/controller/RedObitController.js";
// import RedBaseMaterial from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/base/RedBaseMaterial.js";
// import RedShareGLSL from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/src/base/RedShareGLSL.js";
import RedGPU from "https://rawcdn.githack.com/redcamel/RedGPU/68757c12396a9c37bd72f05139eb797e12fa1a98/dist/RedGPU.min.mjs";

class VertexColorMaterial extends RedGPU.BaseMaterial {
    static vertexShaderGLSL = `
    #version 460
    ${RedGPU.ShareGLSL.GLSL_SystemUniforms_vertex.systemUniforms}
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
    static PROGRAM_OPTION_LIST = {vertex: [], fragment: []};
    static uniformsBindGroupLayoutDescriptor_material = {
		bindings: [
			{binding: 0, visibility: GPUShaderStage.FRAGMENT, type: "uniform-buffer"}
		]
    };
    static uniformBufferDescriptor_vertex = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;
    static uniformBufferDescriptor_fragment = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;

    constructor(redGPUContext) {
        super(redGPUContext);
        this.needResetBindingInfo = true
    }
    resetBindingInfo() {
        this.bindings = [
            {
                binding: 0,
                resource: {
                    buffer: this.uniformBuffer_fragment.GPUBuffer,
                    offset: 0,
                    size: this.uniformBufferDescriptor_fragment.size
                }
            }
        ];
        this._afterResetBindingInfo();
    }
}

(async function () {
    const c = document.getElementById('canvas');
    new RedGPU.RedGPUContext(
        c,
        function () {

            let tScene = new RedGPU.Scene();
            tScene.backgroundColor = '#fff';
            
            let tCamera = new RedGPU.ObitController(this);

            let tView = new RedGPU.View(this, tScene, tCamera);
            this.addView(tView);
            tCamera.distance = 2;

            this.setSize(window.innerWidth, window.innerHeight);

            let interleaveData = new Float32Array(
                [
                    // x,   y,   z,    r,   g,   b    a
                     0.0,  0.5, 0.0,   0.0, 0.0, 1.0, 1.0,
                    -0.5, -0.5, 0.0,   0.0, 0.0, 1.0, 1.0,
                     0.5, -0.5, 0.0,   0.0,-0.0, 1.0, 1.0
                ]
            );
            let indexData = new Uint16Array(
                [0, 1, 2]
            );
            
            let geometry = new RedGPU.Geometry(
                this,
                new RedGPU.Buffer(
                    this,
                    'interleaveBuffer',
                    RedGPU.Buffer.TYPE_VERTEX,
                    new Float32Array(interleaveData),
                    [
                        new RedGPU.InterleaveInfo('vertexPosition', 'float3'),
                        new RedGPU.InterleaveInfo('vertexColor', 'float4')
                    ]
                ),
                new RedGPU.Buffer(
                    this,
                    'indexBuffer',
                    RedGPU.Buffer.TYPE_INDEX,
                    new Uint32Array(indexData)
                )
            );

            let colorMat = new VertexColorMaterial(this);
            let tMesh = new RedGPU.Mesh(this, geometry, colorMat);
            tScene.addChild(tMesh);

            let renderer = new RedGPU.Render();
            let render = time => {
                renderer.render(time, this);
                requestAnimationFrame(render);
            };
            requestAnimationFrame(render);
            
        }
    );

})();
