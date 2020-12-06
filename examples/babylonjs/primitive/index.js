async function init() {
    const canvas = document.querySelector("#c");
    const engine = new BABYLON.Engine(canvas, true);

    let plane;
    let cube;
    let sphere;
    let circle;
    let cylinder;
    let cone;
    let knot;
    let torus;
    let octa;

    const createScene = function() {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.ArcRotateCamera("camera", 0, 1, 5, BABYLON.Vector3.Zero(), scene);
        camera.setPosition( new BABYLON.Vector3(0, 0, -6) );
        camera.attachControl(canvas, false, false);
        scene.activeCamera = camera;

        scene.clearColor = new BABYLON.Color3(0, 0, 0);

        // CreatePlane(name, size, scene, updatable, sideOrientation)
        plane = BABYLON.Mesh.CreatePlane('plane', 1.0, scene);
        plane.position = new BABYLON.Vector3(-1.5, 1.5, 0); 

        // CreateBox(name, size, scene, updatable, sideOrientation)
        cube = BABYLON.Mesh.CreateBox('cube', 1.0, scene);
        cube.position = new BABYLON.Vector3(0, 1.5, 0); 

        // CreateSphere(name, segments, diameter, scene, updatable, sideOrientation)
        sphere = BABYLON.Mesh.CreateSphere('sphere', 24.0, 1.0, scene);
        sphere.position = new BABYLON.Vector3(1.5, 1.5, 0); 
        
        // CreateDisc(name, radius, tessellation, scene, updatable, sideOrientation)
        circle = BABYLON.Mesh.CreateDisc("disc", 0.5, 24, scene);
        circle.position = new BABYLON.Vector3(-1.5, 0, 0); 
        
        // CreateCylinder(name, height, diameterTop, diameterBottom, tessellation, subdivisions, scene, updatable, sideOrientation)
        cylinder = BABYLON.Mesh.CreateCylinder("Cylinder", 1, 1, 1, 32, scene);
        cylinder.position = new BABYLON.Vector3(0, 0, 0); 

        // CreateCylinder(name, height, diameterTop, diameterBottom, tessellation, subdivisions, scene, updatable, sideOrientation)
        cone = BABYLON.Mesh.CreateCylinder("Cone", 1, 0, 1, 32, scene);
        cone.position = new BABYLON.Vector3(1.5, 0, 0); 
        
        // CreateTorusKnot(name, radius, tube, radialSegments, tubularSegments, p, q, scene, updatable, sideOrientation)
        knot = BABYLON.Mesh.CreateTorusKnot("knot", 0.3, 0.1, 128, 64, 2, 3, scene);
        knot.position = new BABYLON.Vector3(-1.5, -1.5, 0); 

        // CreateTorus(name, diameter, thickness, tessellation, scene, updatable, sideOrientation)
        torus = BABYLON.Mesh.CreateTorus("torus", 1.0, 0.2, 10, scene);
        torus.position = new BABYLON.Vector3(0, -1.5, 0); 
        
        octa = BABYLON.MeshBuilder.CreatePolyhedron("oct", {type: 1, size: 0.5}, scene);
        octa.position = new BABYLON.Vector3(1.5, -1.5, 0); 

        const materialA = new BABYLON.StandardMaterial("materialA", scene);
        materialA.diffuseTexture = new BABYLON.Texture("../../../assets/textures/earth.jpg", scene);
        materialA.emissiveColor = new BABYLON.Color3(1, 1, 1);

        const materialB = new BABYLON.StandardMaterial("materialB", scene);
        materialB.diffuseTexture = new BABYLON.Texture("../../../assets/textures/earth_reverse_left_right_up_down.jpg", scene);
        materialB.emissiveColor = new BABYLON.Color3(1, 1, 1);
        
        plane.material = materialA;
        cube.material = materialA;
        sphere.material = materialB;
        circle.material = materialA;
        cylinder.material = materialA;
        cone.material = materialA;
        knot.material = materialA;
        torus.material = materialA;
        octa.material = materialA;

        return scene;
    }

    const scene = createScene();

    let rad = 0.0;
    engine.runRenderLoop(function () {
        rad += Math.PI * 1.0 / 180.0;

        plane.rotation.y = rad;
        cube.rotation.y = rad;
        sphere.rotation.y = rad;
        circle.rotation.y = rad;
        cylinder.rotation.y = rad;
        cone.rotation.y = rad;
        knot.rotation.y = rad;
        torus.rotation.y = rad;
        octa.rotation.y = rad;

        scene.render();
    });
}

init();
