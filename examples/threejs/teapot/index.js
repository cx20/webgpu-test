import * as THREE from 'three';
import WebGPURenderer from 'three/examples/jsm/renderers/webgpu/WebGPURenderer.js';

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

let angle = 0;
let vertexPositions;
let vertexNormals;
let vertexTextureCoords;
let indices;

let camera, scene, renderer, mesh;

// copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
$.getJSON("../../../assets/json/teapot.json", function (data) {
    vertexPositions = data.vertexPositions;
    vertexTextureCoords = data.vertexTextureCoords;
    vertexNormals = data.vertexNormals;
    indices = data.indices;

    init().then( animate ).catch( error );
});

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000.0);
    camera.position.z = 35.0;

    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexPositions), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexNormals), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vertexTextureCoords), 2));
    geometry.setIndex(indices);
    
    let loader = new THREE.TextureLoader();
    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
    loader.load('../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg', texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        //let material = new MeshLambertMaterial({map: texture}); // TODO: This material is not yet supported
        let material = new THREE.MeshBasicMaterial({map: texture});
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
    });
 
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
    if ( mesh ) {
        //mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.01;
    }
    renderer.render( scene, camera );
}

function error( error ) {
    console.error( error );
}
