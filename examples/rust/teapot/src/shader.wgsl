struct Uniforms {
    modelViewProjectionMatrix : mat4x4<f32>,
};
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) vPosition : vec4<f32>,
    @location(1) vNormal : vec3<f32>,
    @location(2) vTextureCoord : vec2<f32>,
};

@vertex
fn vs_main(
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) textureCoord : vec2<f32>,
) -> VertexOutput {
    var output : VertexOutput;
    output.vPosition = uniforms.modelViewProjectionMatrix * vec4<f32>(position, 1.0);
    output.vNormal = normal;
    output.vTextureCoord = textureCoord;
    output.Position = uniforms.modelViewProjectionMatrix * vec4<f32>(position, 1.0);
    return output;
}

@binding(1) @group(0) var mySampler : sampler;
@binding(2) @group(0) var myTexture : texture_2d<f32>;

struct LightUniforms {
    pointLightingLocation : vec3<f32>,
};
@binding(3) @group(0) var<uniform> light : LightUniforms;

@fragment
fn fs_main(
    @location(0) vPosition : vec4<f32>,
    @location(1) vNormal : vec3<f32>,
    @location(2) vTextureCoord : vec2<f32>,
) -> @location(0) vec4<f32> {
    let lightDirection = normalize(light.pointLightingLocation - vPosition.xyz);
    let normal = normalize(vNormal);
    let lightWeighting = max(dot(normal, lightDirection), 0.0);
    let fragmentColor = textureSample(myTexture, mySampler, vTextureCoord);
    return vec4<f32>(fragmentColor.rgb * lightWeighting, fragmentColor.a);
}
