import * as THREE from 'three';
import WebGPURenderer from 'three/addons/renderers/webgpu/WebGPURenderer.js';
import * as Nodes from 'three/nodes';

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

    const vertexPositions = [
        [ 0.0,  0.5, 0.0], // v0
        [-0.5, -0.5, 0.0], // v1
        [ 0.5, -0.5, 0.0]  // v2
    ];
    const vertices = new Float32Array(vertexPositions.length * 3);
    for (let i = 0; i < vertexPositions.length; i++) {
        vertices[i * 3 + 0] = vertexPositions[i][0];
        vertices[i * 3 + 1] = vertexPositions[i][1];
        vertices[i * 3 + 2] = vertexPositions[i][2];
    }
    
    const uvs = new Float32Array([
        0.0, 0.0,
        0.0, 0.0,
        0.0, 0.0
    ]);

	const helper = new THREE.GridHelper( 1000, 40, 0x303030, 0x303030 );
	helper.material.colorNode = new Nodes.AttributeNode( 'color' );
	helper.position.y = - 75;
	scene.add( helper );

	const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); // TODO: If you do not specify the uv attribute, an error occurs

	const material = new Nodes.MeshBasicNodeMaterial();
	material.colorNode = new Nodes.UniformNode( new THREE.Color( 0x0000FF ) );
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new WebGPURenderer();
    renderer.setClearColor(0xffffff);
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

function error( error ) {
    console.error( error );
}
