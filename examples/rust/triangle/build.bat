rustup default nightly
cargo install -f wasm-bindgen-cli
SET RUSTFLAGS=--cfg=web_sys_unstable_apis
cargo build --target=wasm32-unknown-unknown --release
wasm-bindgen --web target/wasm32-unknown-unknown/release/triangle.wasm --out-dir .
