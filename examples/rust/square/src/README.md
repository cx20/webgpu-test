# square

This example renders a square to a window.

## How To Build

```
glslangvalidator -V shader.vert -o shader.vert.spv
glslangvalidator -V shader.frag -o shader.frag.spv

rustup default nightly

cargo install -f wasm-bindgen-cli --version 0.2.73

SET RUSTFLAGS=--cfg=web_sys_unstable_apis 
cargo build --target wasm32-unknown-unknown --example square --release

wasm-bindgen --out-dir target/generated --web target/wasm32-unknown-unknown/release/examples/square.wasm
```

See the wgpu-rs [wiki article](https://github.com/gfx-rs/wgpu-rs/wiki/Running-on-the-Web-with-WebGPU-and-WebGL) for more details.

