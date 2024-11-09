import * as THREE from 'three';
import { color, attribute } from 'three/tsl';

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
    const colors = [ 
        1.0, 0.0, 0.0, 1.0, // v0
        0.0, 1.0, 0.0, 1.0, // v1
        0.0, 0.0, 1.0, 1.0, // v2
        1.0, 1.0, 0.0, 1.0  // v3
    ];
    const indices = [
        0, 2, 1, 
        2, 3, 1
    ];
    
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = attribute('color');

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new THREE.WebGPURenderer();
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
