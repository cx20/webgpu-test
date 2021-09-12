struct VertexInput {
    [[location(0)]] position : vec3<f32>;
};

struct VertexOutput {
    [[builtin(position)]] Position : vec4<f32>;
};

[[stage(vertex)]]
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.Position = vec4<f32>(input.position, 1.0);
    return output;
}

[[stage(fragment)]]
fn fs_main() -> [[location(0)]] vec4<f32> {
    return vec4<f32>(0.0, 0.0, 1.0, 1.0);
}
