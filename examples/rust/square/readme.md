# square

This example renders a square to a `<canvas>` using WebGPU (wgpu) compiled to WebAssembly.

## How To Build

```
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/square.wasm --out-dir .
```

Then serve this directory over HTTP and open `index.html` in a WebGPU-capable browser.

See the wgpu [examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples) for more details.
