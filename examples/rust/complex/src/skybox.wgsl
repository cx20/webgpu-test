struct SkyboxUniforms {
    projectionMatrix : mat4x4<f32>,
    viewMatrix : mat4x4<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : SkyboxUniforms;
@binding(1) @group(0) var skyboxSampler : sampler;
@binding(2) @group(0) var skyboxTexture : texture_cube<f32>;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vTexCoord : vec3<f32>,
};

@vertex
fn vs_skybox(@location(0) position : vec3<f32>) -> VertexOutput {
    var output : VertexOutput;
    output.vTexCoord = position;
    let pos = uniforms.projectionMatrix * uniforms.viewMatrix * vec4<f32>(position, 1.0);
    output.position = vec4<f32>(pos.xy, pos.w, pos.w); // z = w so depth = 1.0
    return output;
}

@fragment
fn fs_skybox(@location(0) vTexCoord : vec3<f32>) -> @location(0) vec4<f32> {
    return textureSample(skyboxTexture, skyboxSampler, vTexCoord);
}
