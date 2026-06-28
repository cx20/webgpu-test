struct Uniforms {
    modelMatrix : mat4x4<f32>,
    viewMatrix : mat4x4<f32>,
    projectionMatrix : mat4x4<f32>,
    normalMatrix : mat4x4<f32>,
    lightDir : vec4<f32>,
    baseColor : vec4<f32>,
    flags : vec4<u32>, // x: hasSkinning, y: hasTexture, z: hasNormals
};

struct JointMatrices {
    matrices : array<mat4x4<f32>, 180>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<storage, read> jointMatrices : JointMatrices;
@binding(2) @group(0) var texSampler : sampler;
@binding(3) @group(0) var texTexture : texture_2d<f32>;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) texCoord : vec2<f32>,
    @location(3) joints : vec4<u32>,
    @location(4) weights : vec4<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vNormal : vec3<f32>,
    @location(1) vTexCoord : vec2<f32>,
    @location(2) vPosition : vec3<f32>,
    @location(3) vWorldPosition : vec3<f32>,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;

    var position = vec4<f32>(input.position, 1.0);
    var normal = input.normal;

    if (uniforms.flags.x == 1u) {
        let skinMatrix =
            input.weights.x * jointMatrices.matrices[input.joints.x] +
            input.weights.y * jointMatrices.matrices[input.joints.y] +
            input.weights.z * jointMatrices.matrices[input.joints.z] +
            input.weights.w * jointMatrices.matrices[input.joints.w];
        position = skinMatrix * position;
        normal = (skinMatrix * vec4<f32>(normal, 0.0)).xyz;
    }

    let worldPosition = uniforms.modelMatrix * position;
    output.vPosition = worldPosition.xyz;
    output.vWorldPosition = worldPosition.xyz;
    output.vNormal = (uniforms.normalMatrix * vec4<f32>(normal, 0.0)).xyz;
    output.vTexCoord = input.texCoord;
    output.position = uniforms.projectionMatrix * uniforms.viewMatrix * worldPosition;

    return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4<f32> {
    var normal : vec3<f32>;

    if (uniforms.flags.z == 1u) {
        // Has normals: use the interpolated normal.
        normal = normalize(input.vNormal);
    } else {
        // No normals: derive a flat normal from screen-space derivatives.
        let ddx = dpdx(input.vWorldPosition);
        let ddy = dpdy(input.vWorldPosition);
        normal = normalize(cross(ddx, ddy));
    }

    let lightDir = normalize(uniforms.lightDir.xyz);
    let diff = max(dot(normal, lightDir), 0.0);
    let ambient = 0.3;
    let lighting = ambient + diff * 0.7;

    var baseColor : vec4<f32>;
    if (uniforms.flags.y == 1u) {
        baseColor = textureSample(texTexture, texSampler, input.vTexCoord);
    } else {
        baseColor = uniforms.baseColor;
    }

    var finalColor = baseColor.rgb * lighting;
    finalColor = pow(finalColor, vec3<f32>(1.0 / 2.2));
    return vec4<f32>(finalColor, baseColor.a);
}
