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
|   [plane]    [cube]    (sphere)          |
|                                          |
|   (circle)   [cyl.]    /cone\            |
|                                          |
|   /tetra\   <octa>    (torus)            |
+------------------------------------------+
```

Nine primitives in a 3x3 grid, each textured with the earth map and
spinning. The geometry that the JS reference builds with
[manifold-3d](https://github.com/elalish/manifold) (cube/sphere/cylinder/
cone) is instead generated directly in C++ here, so there is no external
dependency. The texture (`assets/textures/earth.jpg`) is embedded as a byte
array (`src/earth_jpg.h`) and decoded at runtime with
[stb_image](https://github.com/nothings/stb) (`../common/stb_image.h`).

[Live Demo](https://cx20.github.io/webgpu-test/examples/wasm_cpp/primitive/index.html)

Caution:

> Use Emscripten 4.0.10 or higher to compile (the built-in `emdawnwebgpu` port).
> 
> The legacy `-s USE_WEBGPU=1` bindings are deprecated; this sample uses Dawn's `--use-port=emdawnwebgpu`, which provides the up-to-date `webgpu.h` C API (surface-based rendering, `WGPUStringView`, etc.).
> 
> This sample runs in any browser with WebGPU enabled (e.g. recent Chrome / Edge).
