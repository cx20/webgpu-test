compile:

Please compile from `emsdk\emcmdprompt.bat`.
```
emcc ^
    -std=c++11 ^
   -O3 ^
   -s MINIMAL_RUNTIME=2 ^
   --use-port=emdawnwebgpu ^
   -s WASM=1 ^
   --shell-file src/template.html ^
   src/glue.cpp ^
   src/hello.cpp ^
   -o index.html
```
Result:
```
+------------------------------------------+
|Hello, World!                    [_][~][X]|
+------------------------------------------+
|                                          |
|                   / \                    |
|                 /     \                  |
|               /         \                |
|             /             \              |
|           /                 \            |
|         /                     \          |
|       /                         \        |
|     /                             \      |
|    - - - - - - - - - - - - - - - - -     |
+------------------------------------------+
```

[Live Demo](https://cx20.github.io/hello/wasm_cpp/webgpu/triangle/)

Caution:

> Use Emscripten 4.0.10 or higher to compile (the built-in `emdawnwebgpu` port).
> 
> The legacy `-s USE_WEBGPU=1` bindings are deprecated; these samples now use Dawn's `--use-port=emdawnwebgpu`, which provides the up-to-date `webgpu.h` C API (surface-based rendering, `WGPUStringView`, etc.).
> 
> These samples run in any browser with WebGPU enabled (e.g. recent Chrome / Edge).
