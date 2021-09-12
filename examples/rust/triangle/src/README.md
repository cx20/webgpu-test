# triangle

This example renders a triangle to a window.

## How To Build

```
rustup default nightly

cargo install -f wasm-bindgen-cli

SET RUSTFLAGS=--cfg=web_sys_unstable_apis
cargo build --target wasm32-unknown-unknown --example triangle --release

wasm-bindgen --out-dir target/generated --web target/wasm32-unknown-unknown/release/examples/triangle.wasm
```

See the wgpu-rs [wiki article](https://github.com/gfx-rs/wgpu-rs/wiki/Running-on-the-Web-with-WebGPU-and-WebGL) for more details.

