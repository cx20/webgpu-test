import {
    Camera,
    Mesh,
    MeshBasicMaterial,
    BufferGeometry,
    BufferAttribute,
    PerspectiveCamera,
    Scene,
    Texture,
    TextureLoader,
    RepeatWrapping,
    Vector3,
    Quaternion
} from 'https://raw.githack.com/mrdoob/three.js/r111/build/three.module.js';
import WebGPURenderer from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/44d91fcc5ce2f92d71f1811d36f59b5a6510753e/src/renderers/WebGPURenderer.js';
import glslangModule from 'https://rawcdn.githack.com/takahirox/THREE.WebGPURenderer/44d91fcc5ce2f92d71f1811d36f59b5a6510753e/examples/jsm/libs/glslang.js';

let angle = 0;
let vertexPositions;
let vertexNormals;
let vertexTextureCoords;
let indices;

const run = async () => {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const glslang = await glslangModule();

    const renderer = new WebGPURenderer({
        device,
        glslang
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    //renderer.setClearColor(0x000000); // TODO: This method is not yet supported
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    const scene = new Scene();

    const camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000.0);
    camera.position.z = 35.0;

    let geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertexPositions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(vertexNormals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(vertexTextureCoords), 2));
    geometry.setIndex(new BufferAttribute(new Uint16Array(indices),1));
    let mesh;
    
    let loader = new TextureLoader();
    // copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/arroway.de_metal%2Bstructure%2B06_d100_flat.jpg
    loader.load('../../../assets/textures/arroway.de_metal+structure+06_d100_flat.jpg', texture => {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        //let material = new MeshLambertMaterial({map: texture}); // TODO: This material is not yet supported
        let material = new MeshBasicMaterial({map: texture});

        mesh = new Mesh(geometry, material);
        scene.add(mesh);

        render();
    });
 
    const render = () => {
        requestAnimationFrame(render);
        let axis = new Vector3(0, 1, 0).normalize();
        angle += Math.PI / 180;
        let q = new Quaternion();
        q.setFromAxisAngle(axis,angle);
        mesh.quaternion.copy(q);
        renderer.render(scene, camera);
    };

    const onResize = event => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', onResize, false);
};

// copy from: https://github.com/gpjt/webgl-lessons/blob/master/lesson14/Teapot.json
$.getJSON("../../../assets/json/teapot.json", function (data) {
    vertexPositions = data.vertexPositions;
    vertexTextureCoords = data.vertexTextureCoords;
    vertexNormals = data.vertexNormals;
    indices = data.indices;

    run();
});
