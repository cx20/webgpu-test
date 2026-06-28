# complex

This example composites three animated glTF models (CesiumMilkTruck, Fox and
T-Rex) with GPU skinning, a cubemap skybox and ground tracks, rendered to a
`<canvas>` using WebGPU (wgpu) compiled to WebAssembly.

The models and the skybox are fetched at runtime from the same remote URLs as
the JavaScript reference, parsed with the [`gltf`](https://crates.io/crates/gltf)
crate, and skinned on the GPU (joint matrices in a storage buffer). An internet
connection is therefore required to view this example.

## How To Build

```
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/complex.wasm --out-dir .
```

Then serve this directory over HTTP and open `index.html` in a WebGPU-capable browser.

See the wgpu [examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples) for more details.
