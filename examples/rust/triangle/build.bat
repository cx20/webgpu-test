rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --target web target/wasm32-unknown-unknown/release/triangle.wasm --out-dir .
