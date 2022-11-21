# square

This example renders a square to a window.

## How To Build

```
rustup default nightly

cargo install -f wasm-bindgen-cli

SET RUSTFLAGS=--cfg=web_sys_unstable_apis 
cargo build --target wasm32-unknown-unknown --example square --release

wasm-bindgen --out-dir target/generated --web target/wasm32-unknown-unknown/release/examples/square.wasm
```

See the wgpu-rs [wiki article](https://github.com/gfx-rs/wgpu/wiki/Running-on-the-Web-with-WebGPU-and-WebGL) for more details.

