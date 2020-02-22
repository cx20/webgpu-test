import {
    Camera,
    Mesh,
    MeshBasicMaterial,
    BufferGeometry,
    BufferAttribute,
    PerspectiveCamera,
    PlaneGeometry,
    Scene
} from 'https://raw.githack.com/mrdoob/three.js/r111/build/three.module.js';
import WebGPURenderer from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/44d91fcc5ce2f92d71f1811d36f59b5a6510753e/src/renderers/WebGPURenderer.js';
import glslangModule from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/44d91fcc5ce2f92d71f1811d36f59b5a6510753e/examples/jsm/libs/glslang.js';

const run = async () => {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const glslang = await glslangModule();

    const renderer = new WebGPURenderer({
        device,
        glslang
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const scene = new Scene();

    const camera = new PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000.0);
    camera.position.z = 3.0;

    let material = new MeshBasicMaterial({ color: 0x0000ff });
    //let material = new MeshBasicMaterial({vertexColors: VertexColors}); // TODO: VertexColors not yet supported
    
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
    const vertexPositions = [
        [-0.5, 0.5, 0.0], // v0
        [ 0.5, 0.5, 0.0], // v1 
        [-0.5,-0.5, 0.0], // v2
        [ 0.5,-0.5, 0.0]  // v3
    ];

    const vertices = new Float32Array(vertexPositions.length * 3);
    for (let i = 0; i < vertexPositions.length; i++) {
        vertices[i * 3 + 0] = vertexPositions[i][0];
        vertices[i * 3 + 1] = vertexPositions[i][1];
        vertices[i * 3 + 2] = vertexPositions[i][2];
    }

    const vertexColors = [
        [1.0, 0.0, 0.0, 1.0], // v0
        [0.0, 1.0, 0.0, 1.0], // v1
        [0.0, 0.0, 1.0, 1.0], // v2
        [1.0, 1.0, 0.0, 1.0]  // v3
    ];

    const colors = new Float32Array(vertexColors.length * 4);
    for (let i = 0; i < vertexColors.length; i++) {
        colors[i * 4 + 0] = vertexColors[i][0];
        colors[i * 4 + 1] = vertexColors[i][1];
        colors[i * 4 + 2] = vertexColors[i][2];
        colors[i * 4 + 3] = vertexColors[i][3];
    }
    
    const indices = new Uint16Array([
        2, 0, 1, // v2-v0-v1
        2, 1, 3  // v2-v1-v3
    ]);
    
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 4));
    geometry.setIndex(new BufferAttribute(indices, 1));
    
    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const render = () => {
        requestAnimationFrame(render);
        renderer.render(scene, camera);
    };

    const onResize = event => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', onResize, false);

    render();
};

run();
