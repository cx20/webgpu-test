emcc ^
    -std=c++11 ^
   -O3 ^
   -s MINIMAL_RUNTIME=2 ^
   -s USE_WEBGPU=1 ^
   -s WASM=1 ^
   --shell-file src/template.html ^
   src/glue.cpp ^
   src/hello.cpp ^
   -o index.html
