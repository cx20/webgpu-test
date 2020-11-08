# triangle

This example renders a triangle to a window.

## How To Build

```
glslangvalidator -V shader.vert -o shader.vert.spv
glslangvalidator -V shader.frag -o shader.frag.spv

cargo build --target wasm32-unknown-unknown --example triangle --release

wasm-bindgen --out-dir target/generated --web target/wasm32-unknown-unknown/debug/examples/triangle.wasm
```
