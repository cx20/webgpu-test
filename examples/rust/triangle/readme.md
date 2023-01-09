# triangle

This example renders a triangle to a window.

## How To Build

```
rustup default nightly
cargo install -f wasm-bindgen-cli
SET RUSTFLAGS=--cfg=web_sys_unstable_apis
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --web target/wasm32-unknown-unknown/release/hello.wasm --out-dir .
```

See the wgpu-rs [wiki article](https://github.com/gfx-rs/wgpu/wiki/Running-on-the-Web-with-WebGPU-and-WebGL) for more details.

