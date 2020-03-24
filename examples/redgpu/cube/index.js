import RedGPU from "https://redcamel.github.io/RedGPU/src/RedGPU.js";

const c = document.getElementById('canvas');

class VertexColorMaterial extends RedGPU.BaseMaterial {
    static vertexShaderGLSL = `
    #version 460
    ${RedGPU.ShareGLSL.GLSL_SystemUniforms_vertex.systemUniforms}
    ${RedGPU.ShareGLSL.GLSL_SystemUniforms_vertex.meshUniforms}
    layout(set = 2, binding = 0) uniform Uniforms {
        mat4 modelMatrix;
    } uniforms;
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
        bindings: []
    };
    static uniformBufferDescriptor_vertex = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;
    static uniformBufferDescriptor_fragment = RedGPU.BaseMaterial.uniformBufferDescriptor_empty;

    constructor(redGPU) {
        super(redGPU);
        this.resetBindingInfo()
    }

    resetBindingInfo() {
        this.bindings = [];
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
        tCamera.tilt = 0;

        this.setSize(window.innerWidth, window.innerHeight);

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
        tMesh.cullMode = 'none';
        tScene.addChild(tMesh);

        let renderer = new RedGPU.Render();
        let render = (time) => {
            tMesh.rotationX += 1;
            tMesh.rotationY += 1;
            tMesh.rotationZ += 1;
            renderer.render(time, this);
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }
)
