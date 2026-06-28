# primitive

This example renders a 3x3 grid of textured, rotating primitives (plane, cube,
sphere, circle, cylinder, cone, tetrahedron, octahedron, torus) to a `<canvas>`
using WebGPU (wgpu) compiled to WebAssembly.

The meshes are generated natively in Rust (see `src/geometry.rs`); the texture
is embedded into the wasm module at build time via `include_bytes!`.

## How To Build

```
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/primitive.wasm --out-dir .
```

Then serve this directory over HTTP and open `index.html` in a WebGPU-capable browser.

See the wgpu [examples](https://github.com/gfx-rs/wgpu/tree/trunk/examples) for more details.
