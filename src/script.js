import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GainMapLoader } from "@monogrid/gainmap-js";
import { environments } from "./environments.js";

/**
 * Baes
 */
// Debug
const gui = new GUI({
  width: 350,
  title: "Debug UI",
  closeFolders: true,
});
const lightTweaks = gui.addFolder("Lighting");
const materialTweaks = gui.addFolder("Material Controls");

const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("#ffffff");

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: canvas,
  alpha: true,
});
renderer.toneMappingExposure = 1.7;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//loaders
const gainMapLoader = new GainMapLoader(renderer);
// const ktx2Loader = new KTX2Loader();
const textureLoader = new THREE.TextureLoader();
// ktx2Loader.setTranscoderPath("/textures/");
// ktx2Loader.detectSupport(renderer);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
// gltfLoader.setKTX2Loader(ktx2Loader);

const textures = {};
const meshReferences = {
  anisotropyEnds: null,
  anisotropyClamps: null,
  base: null,
  nonBase: null,
};

// Plane bakeds hadow texture
const planeTexture = textureLoader.load("textures/plane-diffuse2k.jpg");
// planeTexture.colorSpace = THREE.SRGBColorSpace;

// Shifter Texture
// ktx2Loader.load("textures/anisotropy--invert.ktx2", (texture) => {
//   textures.anisotropy = texture;
textures.anisotropy = textureLoader.load("textures/shifter-clean-anisotropy.png")
textures.anisotropy.flipY = false;
console.log(textures.anisotropy)

// Shifter

// gltfLoader.load("models/h1sq-shiny.glb", (gltf) => {
gltfLoader.load("models/h1sq-shiny-clearcoat.glb", (gltf) => {
  const shifter = gltf.scene;
  const physicalMeshes = []; // Array to store all MeshPhysicalMaterial meshes

  shifter.traverse((child) => {
    // Only process Mesh objects
    if (!child.isMesh) return;

    // Skip the mesh named 'standardMaterial'
    if (child.name === "standardMaterial") {
      meshReferences[child.name] = child;
      return;
    }

    // Identify meshes that should have physical material + anisotropy
    if (
      child.name === "anisotropyEnds" ||
      child.name === "anisotropyClamps" ||
      child.name === "anisotropyScrew" ||
      child.name === "physicalMaterial"
    ) {
      const oldMaterial = child.material;

      // Assign a custom anisotropy value based on mesh name
      let anisotropyStrength = 0;
      if (child.name === "anisotropyEnds") anisotropyStrength = 0.08;
      if (child.name === "anisotropyClamps") anisotropyStrength = 0.12;
      if (child.name === "anisotropyScrew") anisotropyStrength = 0.08;
      // If the mesh is 'physicalMaterial', set anisotropy to 0
      if (child.name === "physicalMaterial") anisotropyStrength = 0;

      // Create a new MeshPhysicalMaterial, copying over old properties
      const physicalMaterial = new THREE.MeshPhysicalMaterial({
        map: oldMaterial.map,
        normalMap: oldMaterial.normalMap,
        roughnessMap: oldMaterial.roughnessMap,
        metalnessMap: oldMaterial.metalnessMap,
        color: oldMaterial.color,
        metalness: oldMaterial.metalness,
        roughness: oldMaterial.roughness,

        // Anisotropy
        anisotropyMap: textures.anisotropy,
        anisotropyRotation: 1.94,
        anisotropy: anisotropyStrength,

        // Clearcoat
        clearcoat: 0.5,            // default clearcoat
        clearcoatRoughness: 0.00,  // default clearcoat roughness
      });

      // Dispose of the old material and apply new
      oldMaterial.dispose();
      child.material = physicalMaterial;

      // Store a reference to the mesh for GUI tweaks
      meshReferences[child.name] = child;
      physicalMeshes.push(child); // Add to physicalMeshes array
    } else {
      // For any other mesh not explicitly handled above
      meshReferences[child.name] = child;
    }
  });

  shifter.position.set(0, 0, 0);
  scene.add(shifter);

  // ----- lil-gui controls -----

  // Shared Clearcoat Parameters
  const clearcoatParams = {
    clearcoat: 1.0,
    clearcoatRoughness: 0.25,
  };

  // Clearcoat Slider
  materialTweaks
    .add(clearcoatParams, "clearcoat")
    .min(0)
    .max(1)
    .step(0.01)
    .name("All Clearcoat")
    .onChange((value) => {
      physicalMeshes.forEach((mesh) => {
        mesh.material.clearcoat = value;
      });
    });

  // Clearcoat Roughness Slider
  materialTweaks
    .add(clearcoatParams, "clearcoatRoughness")
    .min(0)
    .max(1)
    .step(0.01)
    .name("All Clearcoat Roughness")
    .onChange((value) => {
      physicalMeshes.forEach((mesh) => {
        mesh.material.clearcoatRoughness = value;
      });
    });

  // Anisotropy intensity for each 'anisotropy' mesh
  materialTweaks
    .add(meshReferences.anisotropyEnds.material, "anisotropy")
    .min(0)
    .max(1)
    .step(0.01)
    .name("Ends Anisotropy");

  materialTweaks
    .add(meshReferences.anisotropyClamps.material, "anisotropy")
    .min(0)
    .max(1)
    .step(0.01)
    .name("Clamps Anisotropy");

  materialTweaks
    .add(meshReferences.anisotropyScrew.material, "anisotropy")
    .min(0)
    .max(1)
    .step(0.01)
    .name("Screw Anisotropy");

  // Physical Material Anisotropy (if needed)
  materialTweaks
    .add(meshReferences.physicalMaterial.material, "anisotropy")
    .min(0)
    .max(1)
    .step(0.01)
    .name("Physical Anisotropy");

  // Shared Roughness Update (if still needed)
  const updateRoughness = (value) => {
    physicalMeshes.forEach((mesh) => {
      mesh.material.roughness = value;
    });
  };

  materialTweaks
    .add({ roughness: 0.5 }, "roughness")
    .min(0)
    .max(1)
    .step(0.01)
    .name("Polished Parts Roughness")
    .onChange(updateRoughness);
});

// Floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(7.62, 7.62),
  new THREE.MeshBasicMaterial({
    map: planeTexture,
  }),
);
floor.material.toneMapped = false;
floor.rotation.x = -Math.PI * 0.5;
scene.add(floor);

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
lightTweaks.add(ambientLight, "visible").name("Ambient Light");
lightTweaks
  .add(ambientLight, "intensity")
  .min(0)
  .max(10)
  .step(0.001)
  .name("Ambient Light Intensity");

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
directionalLight.position.set(0.5, 0, 0.866);
scene.add(directionalLight);
lightTweaks.add(directionalLight, "visible").name("Directional Light");
lightTweaks
  .add(directionalLight, "intensity")
  .min(0)
  .max(10)
  .step(0.001)
  .name("Directional Light Intensity");

// Set up the necessary components
const pmremGenerator = new THREE.PMREMGenerator(renderer);

// Generate the neutral environment once
const neutralEnvironment = pmremGenerator.fromScene(
  new RoomEnvironment(),
).texture;

// Function to load UltraHDR environment
function loadUltraHDREnvironment(components) {
  return new Promise((resolve, reject) => {
    gainMapLoader.load(
      [components.ldr, components.gainmap, components.json],
      (texture) => {
        texture.renderTarget.texture.mapping =
          THREE.EquirectangularReflectionMapping;
        const envMap = pmremGenerator.fromEquirectangular(
          texture.renderTarget.texture,
        ).texture;
        resolve(envMap);
      },
      undefined, // onProgress callback
      reject, // onError callback
    );
  });
}

// Function to handle environment changes
async function updateEnvironment(environmentId) {
  const envConfig = environments.find((env) => env.id === environmentId);

  if (!envConfig) return;

  switch (environmentId) {
    case "none":
      scene.environment = null;
      scene.background = null;
      break;

    case "neutral":
      scene.environment = neutralEnvironment;
      scene.background = environmentState.showBackground
        ? neutralEnvironment
        : null;
      break;

    default:
      try {
        if (envConfig.components) {
          const envMap = await loadUltraHDREnvironment(envConfig.components);
          scene.environment = envMap;
          scene.background = environmentState.showBackground ? envMap : null;
        }
      } catch (error) {
        console.error(`Failed to load environment ${environmentId}:`, error);
      }
      break;
  }
}

// Set up Debug UI
const environmentState = { environment: "photoStudio", showBackground: false };

const envController = lightTweaks
  .add(
    environmentState,
    "environment",
    environments.map((env) => env.id),
  )
  .name("Environment Map");

lightTweaks
  .add(environmentState, "showBackground")
  .name("Show Environment Background")
  .onChange(() => {
    // Trigger environment update to apply background change
    updateEnvironment(environmentState.environment);
  });
envController.onChange((value) => {
  updateEnvironment(value);
});

// Apply initial environment
updateEnvironment(environmentState.environment);

// Tone mapping
debugObject.toneMaps = {
  noToneMapping: THREE.NoToneMapping,
  linearToneMapping: THREE.LinearToneMapping,
  reinhardToneMapping: THREE.ReinhardToneMapping,
  cineonToneMapping: THREE.CineonToneMapping,
  acesFilmicToneMapping: THREE.ACESFilmicToneMapping,
  agXToneMapping: THREE.AgXToneMapping,
  neutralToneMapping: THREE.NeutralToneMapping,
};

renderer.toneMapping = THREE.NeutralToneMapping;
lightTweaks
  .add(renderer, "toneMapping", debugObject.toneMaps)
  .onChange((value) => {
    renderer.toneMapping = value;
  });

lightTweaks.add(renderer, "toneMappingExposure").min(0).max(2).step(0.01);

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100,
);
camera.position.set(1.5, 2.75, 3.5);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.75, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.maxPolarAngle = Math.PI * 0.55;

/**
 * Animate
 */
const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
