import {
    BoxBufferGeometry,
    BufferAttribute,
    Camera,
    Mesh,
    MeshBasicMaterial,
    Shape,
    ShapeGeometry,
    BoxGeometry,
    PerspectiveCamera,
    Scene,
    Texture,
    TextureLoader,
    VertexColors
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
    camera.position.z = 5.0;

/*
    let box;

    new TextureLoader().load('../../../assets/textures/frog.jpg', texture => {
        box = new Mesh(
            new BoxBufferGeometry(1, 1, 1),
            new MeshBasicMaterial({
                map: texture
            })
        );
        box.rotation.x = 45 * Math.PI / 180;
        scene.add(box);

    });
*/
    var geometry = new BoxBufferGeometry(1, 1, 1);
/*
    var vertexColors = [
        [1.0, 0.0, 0.0, 1.0], // Front face
        [1.0, 1.0, 0.0, 1.0], // Back face
        [0.0, 1.0, 0.0, 1.0], // Top face
        [1.0, 0.5, 0.5, 1.0], // Bottom face
        [1.0, 0.0, 1.0, 1.0], // Right face
        [0.0, 0.0, 1.0, 1.0], // Left face
    ];
    for ( var i = 0; i < geometry.faces.length; i += 2 ) {
        var rgb = vertexColors[i/2];
        geometry.faces[ i + 0 ].color.setRGB( rgb[0], rgb[1], rgb[2] );
        geometry.faces[ i + 1 ].color.setRGB( rgb[0], rgb[1], rgb[2] );
    }
*/
    var vertexColors = [
            [1.0, 0.0, 0.0, 1.0], // Front face
            [1.0, 0.0, 0.0, 1.0], // Front face
            [1.0, 0.0, 0.0, 1.0], // Front face
            [1.0, 0.0, 0.0, 1.0], // Front face
            [1.0, 1.0, 0.0, 1.0], // Back face
            [1.0, 1.0, 0.0, 1.0], // Back face
            [1.0, 1.0, 0.0, 1.0], // Back face
            [1.0, 1.0, 0.0, 1.0], // Back face
            [0.0, 1.0, 0.0, 1.0], // Top face
            [0.0, 1.0, 0.0, 1.0], // Top face
            [0.0, 1.0, 0.0, 1.0], // Top face
            [0.0, 1.0, 0.0, 1.0], // Top face
            [1.0, 0.5, 0.5, 1.0], // Bottom face
            [1.0, 0.5, 0.5, 1.0], // Bottom face
            [1.0, 0.5, 0.5, 1.0], // Bottom face
            [1.0, 0.5, 0.5, 1.0], // Bottom face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [1.0, 0.0, 1.0, 1.0], // Right face
            [0.0, 0.0, 1.0, 1.0], // Left face
            [0.0, 0.0, 1.0, 1.0], // Left face
            [0.0, 0.0, 1.0, 1.0], // Left face
            [0.0, 0.0, 1.0, 1.0]  // Left face
    ];
    var colors = new Float32Array(vertexColors.length * 4);
    for (var i = 0; i < vertexColors.length; i++) {
        colors[i * 4 + 0] = vertexColors[i][0];
        colors[i * 4 + 1] = vertexColors[i][1];
        colors[i * 4 + 2] = vertexColors[i][2];
        colors[i * 4 + 3] = vertexColors[i][3];
    }
    //geometry.setAttribute('color', new BufferAttribute(colors, 4));
    var material = new MeshBasicMaterial();
    var mesh = new Mesh(geometry, material);
    scene.add(mesh);

    const render = () => {
        requestAnimationFrame(render);
        //if (box) {
        //    box.rotation.x += 0.01;
        //    box.rotation.y += 0.01;
        //}
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
