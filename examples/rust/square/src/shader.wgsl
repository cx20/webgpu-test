struct VertexOutput {
    @builtin(position) Position : vec4<f32>,
    @location(0) fragColor : vec4<f32>
}

@vertex
fn vs_main(
    @location(0) position : vec3<f32>,
    @location(1) color : vec4<f32>
) -> VertexOutput {
    var output : VertexOutput;
    output.fragColor = color;
    output.Position = vec4<f32>(position, 1.0);
    return output;
}

struct FragmentOutput {
    @location(0) outColor : vec4<f32>
}

@fragment
fn fs_main(
    @location(0) fragColor : vec4<f32>
) -> FragmentOutput {
    var output : FragmentOutput;
    output.outColor = fragColor;
    return output;
}
