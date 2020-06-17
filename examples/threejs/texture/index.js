import {
    BoxBufferGeometry,
    Camera,
    Mesh,
    MeshBasicMaterial,
    PerspectiveCamera,
    Scene,
    Texture,
    TextureLoader
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
    camera.position.z = 5.0;

    let box;
    const loader = new TextureLoader();
    loader.load('../../../assets/textures/frog.jpg', texture => {
        const geometry = new BoxBufferGeometry(1, 1, 1);
        const material = new MeshBasicMaterial({map: texture});
        box = new Mesh(geometry, material);
        scene.add(box);

    });

    const render = () => {
        requestAnimationFrame(render);
        if (box) {
            box.rotation.x += 0.01;
            box.rotation.y += 0.01;
        }
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
