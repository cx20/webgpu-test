struct VertexOutput {
    @builtin(position) Position : vec4<f32>
}

@vertex
fn vs_main(
    @location(0) position : vec3<f32>
) -> VertexOutput {
    var output : VertexOutput;
    output.Position = vec4<f32>(position, 1.0);
    return output;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return vec4<f32>(0.0, 0.0, 1.0, 1.0);
}
