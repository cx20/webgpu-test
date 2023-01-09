/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./index.ts":
/*!******************!*\
  !*** ./index.ts ***!
  \******************/
/***/ (() => {

eval("const vertexShaderWGSL = document.getElementById(\"vs\").textContent;\r\nconst fragmentShaderWGSL = document.getElementById(\"fs\").textContent;\r\ninit();\r\nasync function init() {\r\n    const gpu = navigator[\"gpu\"];\r\n    const adapter = await gpu.requestAdapter();\r\n    const device = await adapter.requestDevice();\r\n    const c = document.getElementById(\"c\");\r\n    c.width = window.innerWidth;\r\n    c.height = window.innerHeight;\r\n    const ctx = c.getContext(\"webgpu\");\r\n    const format = gpu.getPreferredCanvasFormat();\r\n    ctx.configure({\r\n        device: device,\r\n        format: format,\r\n        alphaMode: \"opaque\"\r\n    });\r\n    let vShaderModule = makeShaderModule_WGSL(device, vertexShaderWGSL);\r\n    let fShaderModule = makeShaderModule_WGSL(device, fragmentShaderWGSL);\r\n    // Square data\r\n    //             1.0 y \r\n    //              ^  -1.0 \r\n    //              | / z\r\n    //              |/       x\r\n    // -1.0 -----------------> +1.0\r\n    //            / |\r\n    //      +1.0 /  |\r\n    //           -1.0\r\n    // \r\n    //        [0]------[1]\r\n    //         |        |\r\n    //         |        |\r\n    //         |        |\r\n    //        [2]------[3]\r\n    //\r\n    let positions = [\r\n        -0.5, 0.5, 0.0,\r\n        0.5, 0.5, 0.0,\r\n        -0.5, -0.5, 0.0,\r\n        0.5, -0.5, 0.0 // v3\r\n    ];\r\n    let colors = [\r\n        1.0, 0.0, 0.0, 1.0,\r\n        0.0, 1.0, 0.0, 1.0,\r\n        0.0, 0.0, 1.0, 1.0,\r\n        1.0, 1.0, 0.0, 1.0 // v3\r\n    ];\r\n    let vertexBuffer = makeVertexBuffer(device, new Float32Array(positions));\r\n    let colorBuffer = makeVertexBuffer(device, new Float32Array(colors));\r\n    const pipeline = device.createRenderPipeline({\r\n        layout: \"auto\",\r\n        vertex: {\r\n            module: vShaderModule,\r\n            entryPoint: \"main\",\r\n            buffers: [\r\n                {\r\n                    arrayStride: 3 * 4,\r\n                    attributes: [\r\n                        {\r\n                            // position\r\n                            shaderLocation: 0,\r\n                            offset: 0,\r\n                            format: \"float32x3\"\r\n                        }\r\n                    ]\r\n                },\r\n                {\r\n                    arrayStride: 4 * 4,\r\n                    attributes: [\r\n                        {\r\n                            // color\r\n                            shaderLocation: 1,\r\n                            offset: 0,\r\n                            format: \"float32x4\"\r\n                        }\r\n                    ]\r\n                }\r\n            ]\r\n        },\r\n        fragment: {\r\n            module: fShaderModule,\r\n            entryPoint: \"main\",\r\n            targets: [\r\n                {\r\n                    format: format\r\n                }\r\n            ]\r\n        },\r\n        primitive: {\r\n            topology: \"triangle-strip\",\r\n            stripIndexFormat: \"uint32\"\r\n        },\r\n    });\r\n    let render = function () {\r\n        const commandEncoder = device.createCommandEncoder();\r\n        const textureView = ctx.getCurrentTexture().createView();\r\n        const renderPassDescriptor = {\r\n            colorAttachments: [{\r\n                    view: textureView,\r\n                    loadOp: \"clear\",\r\n                    clearValue: { r: 1, g: 1, b: 1, a: 1 },\r\n                    storeOp: \"store\"\r\n                }]\r\n        };\r\n        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);\r\n        passEncoder.setPipeline(pipeline);\r\n        passEncoder.setVertexBuffer(0, vertexBuffer);\r\n        passEncoder.setVertexBuffer(1, colorBuffer);\r\n        passEncoder.draw(4, 1, 0, 0);\r\n        passEncoder.end();\r\n        device.queue.submit([commandEncoder.finish()]);\r\n        requestAnimationFrame(render);\r\n    };\r\n    requestAnimationFrame(render);\r\n}\r\nfunction makeShaderModule_WGSL(device, source) {\r\n    let shaderModuleDescriptor = {\r\n        code: source\r\n    };\r\n    let shaderModule = device.createShaderModule(shaderModuleDescriptor);\r\n    return shaderModule;\r\n}\r\nfunction makeVertexBuffer(device, data) {\r\n    const verticesBuffer = device.createBuffer({\r\n        size: data.byteLength,\r\n        usage: GPUBufferUsage.VERTEX,\r\n        mappedAtCreation: true,\r\n    });\r\n    new Float32Array(verticesBuffer.getMappedRange()).set(data);\r\n    verticesBuffer.unmap();\r\n    return verticesBuffer;\r\n}\r\n\n\n//# sourceURL=webpack://hello/./index.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./index.ts"]();
/******/ 	
/******/ })()
;