# triangle

This example renders a triangle to a window.

## How To Build

```
cargo build --target wasm32-unknown-unknown --example triangle --release

wasm-bindgen --out-dir target/generated --web target/wasm32-unknown-unknown/debug/examples/triangle.wasm
```
