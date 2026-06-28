# triangle

This example renders a triangle to a `<canvas>` using WebGPU (wgpu) compiled to WebAssembly.

## How To Build

```
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/triangle.wasm --out-dir .
```

See the wgpu [examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples) for more details.
