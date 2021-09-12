struct VertexInput {
    [[location(0)]] position : vec3<f32>;
    [[location(1)]] color : vec4<f32>;
};

struct VertexOutput {
    [[builtin(position)]] Position : vec4<f32>;
    [[location(0)]] fragColor : vec4<f32>;
};

[[stage(vertex)]]
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.fragColor = input.color;
    output.Position = vec4<f32>(input.position, 1.0);
    return output;
}

struct FragmentInput {
    [[location(0)]] fragColor : vec4<f32>;
};

struct FragmentOutput {
    [[location(0)]] outColor : vec4<f32>;
};

[[stage(fragment)]]
fn fs_main(input : FragmentInput) -> FragmentOutput {
    var output : FragmentOutput;
    output.outColor = input.fragColor;
    return output;
}
