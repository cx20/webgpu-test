import RedGPU from "https://redcamel.github.io/RedGPU/src/RedGPU.js";

const c = document.getElementById('canvas');

class VertexColorMaterial extends RedGPU.BaseMaterial {
    static vertexShaderGLSL = `
    #version 460
    ${RedGPU.ShareGLSL.GLSL_SystemUniforms_vertex.systemUniforms}
    ${RedGPU.ShareGLSL.GLSL_SystemUniforms_vertex.meshUniforms}
    layout(location = 0) in vec3 position;
    layout(location = 1) in vec4 vertexColor;
    layout(location = 0) out vec4 vVertexColor;
    void main() {
        gl_Position = systemUniforms.perspectiveMTX * systemUniforms.cameraMTX * meshMatrixUniforms.modelMatrix[ int(meshUniforms.index) ] * vec4(position, 1.0);
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
    static PROGRAM_OPTION_LIST = {
        vertex: [],
        fragment: []
    };
    static uniformsBindGroupLayoutDescriptor_material = {
        entries: []
    };
    static uniformBufferDescriptor_vertex = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;
    static uniformBufferDescriptor_fragment = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;

    constructor(redGPU) {
        super(redGPU);
        this.resetBindingInfo()
    }

    resetBindingInfo() {
        this.entries = [];
        this._afterResetBindingInfo();
    }
}

new RedGPU.RedGPUContext(c,
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
                 0.5, -0.5, 0.0,   0.0, 0.0, 1.0, 1.0
            ]
        );
        let indexData = new Uint32Array(
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
                    new RedGPU.InterleaveInfo('vertexPosition', 'float32x3'),
                    new RedGPU.InterleaveInfo('vertexColor', 'float32x4')
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
        let render = (time) => {
            renderer.render(time, this);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);

    }
)
