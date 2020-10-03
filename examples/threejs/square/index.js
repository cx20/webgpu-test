import * as THREE from 'https://raw.githack.com/mrdoob/three.js/r121/build/three.module.js';
import WebGPURenderer from 'https://raw.githack.com/mrdoob/three.js/r121/examples/jsm/renderers/webgpu/WebGPURenderer.js';

// NOTE: The shader currently used in the WebGPU Renderer's MeshBasicMaterial is the following code.
//       Please note that you cannot specify the color because you are using a texture.

// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/renderers/webgpu/WebGPURenderPipelines.js#L781-L802
// #version 450
// 
// layout(location = 0) in vec3 position;
// layout(location = 1) in vec2 uv;
// 
// layout(location = 0) out vec2 vUv;
// 
// layout(set = 0, binding = 0) uniform ModelUniforms {
//     mat4 modelMatrix;
//     mat4 modelViewMatrix;
//     mat3 normalMatrix;
// } modelUniforms;
// 
// layout(set = 0, binding = 1) uniform CameraUniforms {
//     mat4 projectionMatrix;
//     mat4 viewMatrix;
// } cameraUniforms;
// 
// void main(){
//     vUv = uv;
//     gl_Position = cameraUniforms.projectionMatrix * modelUniforms.modelViewMatrix * vec4( position, 1.0 );
// }
// 

// https://github.com/mrdoob/three.js/blob/dev/examples/jsm/renderers/webgpu/WebGPURenderPipelines.js#L803-L817
// #version 450
// layout(set = 0, binding = 2) uniform OpacityUniforms {
//     float opacity;
// } opacityUniforms;
// 
// layout(set = 0, binding = 3) uniform sampler mySampler;
// layout(set = 0, binding = 4) uniform texture2D myTexture;
// 
// layout(location = 0) in vec2 vUv;
// layout(location = 0) out vec4 outColor;
// 
// void main() {
//     outColor = texture( sampler2D( myTexture, mySampler ), vUv );
//     outColor.a *= opacityUniforms.opacity;
// }

let camera, scene, renderer;

init().then( animate ).catch( error );

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000.0);
    camera.position.z = 3.0;


    // Square data
    //             1.0 y 
    //              ^  -1.0 
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    // 
    //        [0]------[1]
    //         |      / |
    //         |    /   |
    //         |  /     |
    //        [2]------[3]
    //
    const vertices = [
        -0.5, 0.5, 0.0,  // v0
         0.5, 0.5, 0.0,  // v1 
        -0.5,-0.5, 0.0,  // v2
         0.5,-0.5, 0.0,  // v3
    ];
    const uvs = [
         0.0, 1.0,
         1.0, 1.0,
         0.0, 0.0,
         1.0, 0.0
    ];
    const indices = [
        0, 2, 1, 
        2, 3, 1
    ];
    
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // TODO: If you do not specify the uv attribute, an error occurs

    const material = new THREE.MeshBasicMaterial({ map: createDataTexture() }); // TODO: Not color supported yet
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new WebGPURenderer();
    renderer.setClearColor(0x000000);
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    window.addEventListener( 'resize', onWindowResize, false );

    return renderer.init();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate() {
    requestAnimationFrame( animate );
    renderer.render( scene, camera );
}

function createDataTexture() {
    const width = 4;
    const height = 1;
    const data = new Uint8Array([
        255,   0,   0, 255,
          0, 255,   0, 255,
          0,   0, 255, 255,
        255, 255,   0, 255,
    ]);
    return new THREE.DataTexture( data, width, height, THREE.RGBAFormat, undefined, undefined, undefined, undefined, THREE.LinearFilter, THREE.LinearFilter );
}

function error( error ) {
    console.error( error );
}
