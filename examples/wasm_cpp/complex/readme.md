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
|        (sky / cubemap skybox)            |
|     ___        /\_/\                      |
|    |Truck|    ( Fox )      __/T-Rex\__    |
|    |__o_o|     >   <      /          \    |
+------------------------------------------+
```

Unlike the other samples, this one is built with the **standard Emscripten
runtime** (not `MINIMAL_RUNTIME`) and loads all assets from the network **at
runtime over URLs** (no embedded assets):

- glTF models are fetched with `emscripten_async_wget_data` and parsed with
  [cgltf](https://github.com/jkuhlmann/cgltf) (`../common/cgltf.h`); textures
  are decoded with [stb_image](https://github.com/nothings/stb).
- A cubemap **skybox** is loaded from six JPEG faces.

The scene shows three glTF models over an orbiting camera with per-fragment
lighting:

- **CesiumMilkTruck** — node animation (the wheels spin).
- **Fox** and **T-Rex** — GPU **skinning** animation (joint matrices fed to the
  vertex shader through a storage buffer), playing their walk/run clips.

Two white ground tracks (the truck's tyre ruts) are also drawn.

[Live Demo](https://cx20.github.io/webgpu-test/examples/wasm_cpp/complex/index.html)

Caution:

> Use Emscripten 4.0.10 or higher to compile (the built-in `emdawnwebgpu` port).
> 
> Assets are fetched from `cx20.github.io` and `raw.githubusercontent.com`; the
> latter occasionally throttles requests, so loads are retried automatically.
> 
> This sample runs in any browser with WebGPU enabled (e.g. recent Chrome / Edge).
