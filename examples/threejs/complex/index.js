import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let modelInfoSet = [
{
    name: "CesiumMilkTruck",
    scale: 0.4,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, -2],
    url: "https://cx20.github.io/gltf-test/sampleModels/CesiumMilkTruck/glTF/CesiumMilkTruck.gltf"
}, {
    name: "Fox",
    scale: 0.05,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 0],
    url: "https://cx20.github.io/gltf-test/sampleModels/Fox/glTF/Fox.gltf"
}, {
    name: "Rex",
    scale: 1.0,
    rotation: [0, Math.PI / 2, 0],
    position: [0, 0, 3],
    //url: "https://raw.githubusercontent.com/BabylonJS/Exporters/9bc140006be149687be045f60b4a25cdb45ce4fc/Maya/Samples/glTF 2.0/T-Rex/trex_running.gltf" // scale:0.01
    url: "https://raw.githubusercontent.com/BabylonJS/Exporters/d66db9a7042fef66acb62e1b8770739463b0b567/Maya/Samples/glTF%202.0/T-Rex/trex.gltf" // scale:1.0
}];

let mixers = [];
let clock = new THREE.Clock();
let scene;
let camera;
let renderer;
let controls;
let emitter, particleGroup;
let emitters = [];
let loader = new THREE.TextureLoader();
let width;
let height;

init();

async function init() {
    width = window.innerWidth;
    height = window.innerHeight;

    scene = new THREE.Scene();
    scene.position.y = -2;

    camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 10000);
    camera.position.set(0, 2, 10);

    let geometry = new THREE.PlaneGeometry(100,0.1);
    let material = new THREE.MeshStandardNodeMaterial({
        color: "#c5866F"
    });

    let ground1 = new THREE.Mesh(geometry, material);
    ground1.rotation.x = -Math.PI / 2;
    ground1.position.x = -49.5;
    ground1.position.z = -1.6;
    scene.add(ground1);

    let ground2 = new THREE.Mesh(geometry, material);
    ground2.rotation.x = -Math.PI / 2;
    ground2.position.x = -49.5;
    ground2.position.z = -2.35;
    scene.add(ground2);
    
    let ambient = new THREE.AmbientLight(0xdddddd);
    scene.add(ambient);

    const light = new THREE.SpotLight(0xFFFFFF, 2, 100, Math.PI / 4, 8);
    light.position.set(10, 25, -25);
    light.castShadow = true;
    scene.add(light);

    let loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    var envMap = getEnvMap();
    scene.background = envMap;

    for (let i = 0; i < modelInfoSet.length; i++) {
        let m = modelInfoSet[i];
        let url = m.url;
        let scale = m.scale;
        loader.load(url, function(data) {
            let gltf = data;
            let object = gltf.scene;
            object.scale.set(scale, scale, scale);
            object.rotation.set(m.rotation[0], m.rotation[1], m.rotation[2]);
            object.position.set(m.position[0], m.position[1], m.position[2]);

            let animations = gltf.animations;
            if (animations && animations.length) {
                let mixer = new THREE.AnimationMixer(object);
                if (m.name == "Fox") {
                    let animation = animations[2]; // 0:Survey, 1:Walk, 2:Run
                    mixer.clipAction(animation).play();
                } else {
                    for (let j = 0; j < animations.length; j++) {
                        let animation = animations[j];
                        mixer.clipAction(animation).play();
                    }
                }
                mixers.push(mixer);
            }

            object.traverse(function(node) {
                if (node.material) {
                    node.material.envMap = envMap;
                    node.material.needsUpdate = true;
                }
            });

            scene.add(object);
        });
    }

    renderer = new THREE.WebGPURenderer();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.userPan = false;
    controls.userPanSpeed = 0.0;
    controls.maxDistance = 5000.0;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    await renderer.init();

    renderer.setSize(width, height);
    document.body.appendChild(renderer.domElement);

    animate();
}

function getEnvMap() {
    //let path = 'https://raw.githubusercontent.com/cx20/gltf-test/c479d543/textures/cube/skybox/';
    let path = 'https://raw.githubusercontent.com/mrdoob/three.js/3c13d929f8d9a02c89f010a487e73ff0e57437c4/examples/textures/cube/skyboxsun25deg/';
    let format = '.jpg';
    let urls = [
        path + 'px' + format, path + 'nx' + format,
        path + 'py' + format, path + 'ny' + format,
        path + 'pz' + format, path + 'nz' + format
    ];
    let loader = new THREE.CubeTextureLoader();
    loader.setCrossOrigin('anonymous');
    let envMap = loader.load(urls);
    envMap.format = THREE.RGBAFormat;
    return envMap;
}

async function animate() {
    let delta = clock.getDelta();
    if (mixers.length > 0) {
        for (let i = 0; i < mixers.length; i++) {
            let mixer = mixers[i];
            mixer.update(delta);
        }
    }
    //particleGroup.tick( delta );
    controls.update();
    render();
    requestAnimationFrame(animate);
}

async function render() {
    await renderer.render(scene, camera);
}
