compile:

Please compile from `emsdk\emcmdprompt.bat`.
```
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

> Use Emscripten 3.1.3 or higher to compile.
> 
> These samples run in [Chrome Canary](http://chrome.com/canary) and [Edge Canary](https://www.microsoftedgeinsider.com/en-us/download) behind the flag `--enable-unsafe-webgpu`.
