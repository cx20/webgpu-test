emcc ^
    -std=c++17 ^
   -O3 ^
   --use-port=emdawnwebgpu ^
   -s WASM=1 ^
   -s ALLOW_MEMORY_GROWTH=1 ^
   -I../common ^
   --shell-file src/template.html ^
   src/hello.cpp ^
   -o index.html
