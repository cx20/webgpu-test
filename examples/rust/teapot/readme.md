# teapot

This example renders the Utah teapot with diffuse point lighting and a texture
to a `<canvas>` using WebGPU (wgpu) compiled to WebAssembly. The model
(`teapot.json`) and the texture are embedded into the wasm module at build time
via `include_str!` / `include_bytes!`.

## How To Build

```
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/teapot.wasm --out-dir .
```

Then serve this directory over HTTP and open `index.html` in a WebGPU-capable browser.

See the wgpu [examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples) for more details.
