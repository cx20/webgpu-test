import {
    Camera,
    Mesh,
    MeshBasicMaterial,
    BufferGeometry,
    BufferAttribute,
    PerspectiveCamera,
    Scene
} from 'https://raw.githack.com/mrdoob/three.js/r111/build/three.module.js';
import WebGPURenderer from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/a2f57312bf9968fa1c415d63d46b0b35a8c9897f/src/renderers/WebGPURenderer.js';
import glslangModule from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/a2f57312bf9968fa1c415d63d46b0b35a8c9897f/examples/jsm/libs/glslang.js';

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

    const material = new MeshBasicMaterial({ color: 0x0000ff });
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
    
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new BufferAttribute(vertices, 3));

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
