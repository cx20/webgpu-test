import * as THREE from 'three';
import { color, uv, attribute } from 'three/tsl';

let camera, scene, renderer, mesh;

init().then( animate ).catch( error );

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000.0);
    camera.position.z = 5.0;


    // Cube data
    //             1.0 y 
    //              ^  -1.0 
    //              | / z
    //              |/       x
    // -1.0 -----------------> +1.0
    //            / |
    //      +1.0 /  |
    //           -1.0
    // 
    //         [7]------[6]
    //        / |      / |
    //      [3]------[2] |
    //       |  |     |  |
    //       | [4]----|-[5]
    //       |/       |/
    //      [0]------[1]
    //
    const vertices = [
            // Front face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            // Back face
            -0.5, -0.5, -0.5, // v4
             0.5, -0.5, -0.5, // v5
             0.5,  0.5, -0.5, // v6
            -0.5,  0.5, -0.5, // v7
            // Top face
             0.5,  0.5,  0.5, // v2
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
             0.5,  0.5, -0.5, // v6
            // Bottom face
            -0.5, -0.5,  0.5, // v0
             0.5, -0.5,  0.5, // v1
             0.5, -0.5, -0.5, // v5
            -0.5, -0.5, -0.5, // v4
            // Right face
             0.5, -0.5,  0.5, // v1
             0.5,  0.5,  0.5, // v2
             0.5,  0.5, -0.5, // v6
             0.5, -0.5, -0.5, // v5
            // Left face
            -0.5, -0.5,  0.5, // v0
            -0.5,  0.5,  0.5, // v3
            -0.5,  0.5, -0.5, // v7
            -0.5, -0.5, -0.5  // v4
    ];
    const uvs = [
        // Front face
        1, 0,
        0, 0,
        0, 1,
        1, 1,
        // Back face
        1, 0,
        0, 0,
        0, 1,
        1, 1,
        // Top face
        1, 0,
        0, 0,
        0, 1,
        1, 1,
        // Bottom face
        1, 0,
        0, 0,
        0, 1,
        1, 1,
        // Right face
        1, 0,
        0, 0,
        0, 1,
        1, 1,
        // Left face
        1, 0,
        0, 0,
        0, 1,
        1, 1
    ];
    const indices = [
         0,  1,  2,    0,  2 , 3,  // Front face
         4,  5,  6,    4,  6 , 7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23   // Left face
    ];
    
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // TODO: If you do not specify the uv attribute, an error occurs

    const loader = new THREE.TextureLoader();
    loader.load('../../../assets/textures/frog.jpg', texture => {
        const material = new THREE.MeshBasicNodeMaterial({map: texture, side: THREE.DoubleSide});
        mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
    });

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
    if ( mesh ) {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.01;
    }
    renderer.render( scene, camera );
}

function error( error ) {
    console.error( error );
}
