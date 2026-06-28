compile:

Please compile from `emsdk\emcmdprompt.bat` (or run `build.bat`).
```
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
```
Result:
```
+------------------------------------------+
|Hello, World!                    [_][~][X]|
+------------------------------------------+
|         (sky / cubemap skybox)           |
|            ____________                  |
|           /  CesiumMilk \___             |
|          | Truck  [o]  [o] |             |
|           \________________/             |
|             (o)        (o)               |
+------------------------------------------+
```

(WIP) Unlike the other samples, this one is built with the **standard
Emscripten runtime** (not `MINIMAL_RUNTIME`) and loads all assets from the
network **at runtime over URLs** (no embedded assets):

- glTF models are fetched with `emscripten_async_wget_data` and parsed with
  [cgltf](https://github.com/jkuhlmann/cgltf) (`../common/cgltf.h`); textures
  are decoded with [stb_image](https://github.com/nothings/stb).
- A cubemap **skybox** is loaded from six JPEG faces.

Milestone 1 (current): cubemap skybox + the **CesiumMilkTruck** glTF model
(node animation — the wheels spin), with an orbiting camera and per-fragment
lighting. Skinned models (Fox, T-Rex) and the ground tracks from the
`webgpu_wgsl` reference are still to be added.

[Live Demo](https://cx20.github.io/webgpu-test/examples/wasm_cpp/complex/index.html)

Caution:

> Use Emscripten 4.0.10 or higher to compile (the built-in `emdawnwebgpu` port).
> 
> Assets are fetched from `cx20.github.io` and `raw.githubusercontent.com`; the
> latter occasionally throttles requests, so loads are retried automatically.
> 
> This sample runs in any browser with WebGPU enabled (e.g. recent Chrome / Edge).
