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
    camera.position.z = 5.0;

    let material = new MeshBasicMaterial({ color: 0x0000ff });
    //let material = new MeshBasicMaterial({vertexColors: VertexColors}); // TODO: VertexColors not yet supported
    
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
    const vertexPositions = [
            // Front face
            [-0.5, -0.5,  0.5], // v0
            [ 0.5, -0.5,  0.5], // v1
            [ 0.5,  0.5,  0.5], // v2
            [-0.5,  0.5,  0.5], // v3
            // Back face
            [-0.5, -0.5, -0.5], // v4
            [ 0.5, -0.5, -0.5], // v5
            [ 0.5,  0.5, -0.5], // v6
            [-0.5,  0.5, -0.5], // v7
            // Top face
            [ 0.5,  0.5,  0.5], // v2
            [-0.5,  0.5,  0.5], // v3
            [-0.5,  0.5, -0.5], // v7
            [ 0.5,  0.5, -0.5], // v6
            // Bottom face
            [-0.5, -0.5,  0.5], // v0
            [ 0.5, -0.5,  0.5], // v1
            [ 0.5, -0.5, -0.5], // v5
            [-0.5, -0.5, -0.5], // v4
            // Right face
            [ 0.5, -0.5,  0.5], // v1
            [ 0.5,  0.5,  0.5], // v2
            [ 0.5,  0.5, -0.5], // v6
            [ 0.5, -0.5, -0.5], // v5
            // Left face
            [-0.5, -0.5,  0.5], // v0
            [-0.5,  0.5,  0.5], // v3
            [-0.5,  0.5, -0.5], // v7
            [-0.5, -0.5, -0.5]  // v4
    ];
    const vertices = new Float32Array(vertexPositions.length * 3);
    for (let i = 0; i < vertexPositions.length; i++) {
        vertices[i * 3 + 0] = vertexPositions[i][0];
        vertices[i * 3 + 1] = vertexPositions[i][1];
        vertices[i * 3 + 2] = vertexPositions[i][2];
    }

    const vertexColors = [
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
    const colors = new Float32Array(vertexColors.length * 4);
    for (let i = 0; i < vertexColors.length; i++) {
        colors[i * 4 + 0] = vertexColors[i][0];
        colors[i * 4 + 1] = vertexColors[i][1];
        colors[i * 4 + 2] = vertexColors[i][2];
        colors[i * 4 + 3] = vertexColors[i][3];
    }
    
    const indices = new Uint16Array([
         0,  1,  2,    0,  2 , 3,  // Front face
         4,  5,  6,    4,  6 , 7,  // Back face
         8,  9, 10,    8, 10, 11,  // Top face
        12, 13, 14,   12, 14, 15,  // Bottom face
        16, 17, 18,   16, 18, 19,  // Right face
        20, 21, 22,   20, 22, 23   // Left face
    ]);
    
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new BufferAttribute(vertices, 3)); // TODO:
    geometry.setAttribute('color', new BufferAttribute(colors, 4)); // TODO:
    geometry.setIndex(new BufferAttribute(indices, 1));
    
    var box = new Mesh(geometry, material);
    scene.add(box);

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
