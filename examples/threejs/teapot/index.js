import * as THREE from 'three';
import { color, uv, attribute } from 'three/tsl';

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
        const material = new THREE.MeshBasicNodeMaterial({map: texture});
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
    });
 
    renderer = new THREE.WebGPURenderer();
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
