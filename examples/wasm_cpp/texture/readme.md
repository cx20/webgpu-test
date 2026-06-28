compile:

Please compile from `emsdk\emcmdprompt.bat` (or run `build.bat`).
```
emcc ^
    -std=c++11 ^
   -O3 ^
   -s MINIMAL_RUNTIME=2 ^
   --use-port=emdawnwebgpu ^
   -s WASM=1 ^
   -I../common ^
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
|              +---------+                 |
|             /  frog   /|                 |
|            /  image  / |                 |
|           +---------+  |                 |
|           |  frog   |  +                 |
|           |  image  | /                  |
|           |         |/                   |
|           +---------+                    |
+------------------------------------------+
```

The texture (`assets/textures/frog.jpg`) is embedded into the build as a byte
array (`src/frog_jpg.h`) and decoded at runtime with
[stb_image](https://github.com/nothings/stb) (`../common/stb_image.h`), so no
file system access is required.

[Live Demo](https://cx20.github.io/webgpu-test/examples/wasm_cpp/texture/index.html)

Caution:

> Use Emscripten 4.0.10 or higher to compile (the built-in `emdawnwebgpu` port).
> 
> The legacy `-s USE_WEBGPU=1` bindings are deprecated; this sample uses Dawn's `--use-port=emdawnwebgpu`, which provides the up-to-date `webgpu.h` C API (surface-based rendering, `WGPUStringView`, etc.).
> 
> This sample runs in any browser with WebGPU enabled (e.g. recent Chrome / Edge).
