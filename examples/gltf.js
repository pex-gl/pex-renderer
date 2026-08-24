import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import createGUI from "pex-gui";
import { loadJson, loadImage } from "pex-io";
import { quat, vec3 } from "pex-math";
import { aabb } from "pex-geom";

import { cube as createCube } from "primitive-geometry";

import { debugSceneTree, getURL } from "./utils.js";
import { getSceneGraphViz } from "./graph-viz.js";

const MODELS_PATH =
  location.hostname === "localhost"
    ? "examples/glTF-Sample-Assets/Models"
    : "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";

let models = await loadJson(`${MODELS_PATH}/model-index.json`);

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: "",
  scenes: [],
  gridSize: 1,
  helpers: true,
  floor: false,
  useEnvMap: true,
  shadows: false,
  graphViz: false,
  formats: Array.from(
    models.reduce(
      (formats, model) => new Set([...formats, ...Object.keys(model.variants)]),
      new Set(),
    ),
  ).filter((format) => !["glTF-Meshopt"].includes(format)),
  currentFormat: 1,
  modelName: "-",
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });

const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// prettier-ignore
// const legacySpecularGlossinessFlagDefinitions = [
//   [["material", "diffuse"], "USE_SPECULAR_GLOSSINESS_WORKFLOW", { uniform: "uDiffuse" }],
//   [["material", "specular"], "", { uniform: "uSpecular", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
//   [["material", "glossiness"], "", { uniform: "uGlossiness", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
//   [["material", "diffuseTexture"], "DIFFUSE_TEXTURE", { type: "texture", uniform: "uDiffuseTexture", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
//   [["material", "specularGlossinessTexture"], "SPECULAR_GLOSSINESS_TEXTURE", { type: "texture", uniform: "uSpecularGlossinessTexture", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
// ];

// renderEngine.renderers
//   .find((renderer) => renderer.type == "standard-renderer")
//   .flagDefinitions.push(...legacySpecularGlossinessFlagDefinitions);

const gui = createGUI(ctx);

const sunEntity = createEntity({
  transform: components.transform({
    position: State.sunPosition,
    rotation: quat.fromDirection(quat.create(), [-1, -1, -1]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 0,
    castShadows: State.shadows,
  }),
});
world.add(sunEntity);

const skyEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromEuler(quat.create(), [0, -Math.PI / 2, 0]),
  }),
  skybox: components.skybox({
    sunPosition: [0.1, 0.04, -1],
    backgroundBlur: 1,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const postProcessingComponent = components.postProcessing({
  bloom: components.postProcessing.bloom(),
});

let floorEntity;
let cameraEntity;
let animationEntity;

let envMap;

const addEnvmap = async () => {
  if (State.useEnvMap) {
    envMap ??= await loaders.hdr(
      ctx,
      getURL(
        "assets/envmaps/Artist Workshop/artist_workshop_2k.hdr",
        // `assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`
        // `assets/envmaps/garage/garage.hdr`,
        // `assets/envmaps/Footprint Court/footprint_court.hdr`,
        // `assets/envmaps/Artist Workshop/artist_workshop_2k.hdr`,
        // `assets/envmaps/Colorful_Studio.hdr`
      ),
    );
    skyEntity.skybox.envMap = envMap;
  } else {
    skyEntity.skybox.envMap = null;
  }
};
await addEnvmap();

const axesEntity = createEntity({ axesHelper: {} });
world.add(axesEntity);

// Utils
let debugOnce = false;

const sceneGraphViz = getSceneGraphViz();

function openModelURL() {
  window.open(
    State.url.replace(
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/master/2.0/",
      "https://github.com/KhronosGroup/glTF-Sample-Assets/blob/master/2.0/",
    ),
  );
}

// glTF
function repositionModel({ root }) {
  const n = State.gridSize;
  const i = State.scenes.length;
  const x = 2 * (i % n) - n + 1;
  const z = 2 * Math.floor(i / n) - n + 1;

  vec3.add(root.transform.position, [x, 0, z]);
}

function rescaleScene({ root }) {
  const sceneBounds = root.transform.worldBounds;
  const sceneSize = aabb.size(root.transform.worldBounds);
  const sceneCenter = aabb.center(root.transform.worldBounds);
  let maxSize = Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2]));
  if (maxSize == 0 || maxSize == Infinity) maxSize = 1;
  const sceneScale = 1 / maxSize;

  if (!aabb.isEmpty(sceneBounds)) {
    root.transform.position = vec3.scale(
      sceneCenter.map((n) => -n),
      sceneScale,
    );
    root.transform.scale = [sceneScale, sceneScale, sceneScale];
    root.transform.dirty = true;
  }
}

function updateDefaultSky(scene) {
  const hasOwnEnvironment = scene.entities.some(
    (entity) => !!entity.reflectionProbe,
  );
  const inWorld = world.entities.includes(skyEntity);

  if (hasOwnEnvironment && inWorld) {
    world.dispose(skyEntity);
  } else if (!hasOwnEnvironment && !inWorld) {
    world.add(skyEntity);
  }
}

function onSceneLoaded(scene, grid) {
  updateDefaultSky(scene);

  if (grid) {
    rescaleScene(scene);
    repositionModel(scene);
  }

  if (State.floor) {
    floorEntity = createEntity({
      transform: components.transform({ position: [0, -0.525, 0] }),
      geometry: components.geometry(createCube({ sx: 1, sy: 0.05, sz: 1 })),
      material: components.material({ baseColor: [0.5, 0.5, 0.5, 1] }),
    });
    world.add(floorEntity);
  }

  if (State.helpers) {
    scene.entities.forEach((entity) => {
      if (entity.geometry) {
        entity.boundingBoxHelper = components.boundingBoxHelper();
      }
      if (entity.skin) {
        entity.skeletonHelper = components.skeletonHelper();
      }
      if (entity.camera) {
        entity.cameraHelper = components.cameraHelper();
      }
    });
  }

  sceneGraphViz.init(State.scenes[0].entities);
  if (sceneGraphViz.isRendered()) sceneGraphViz.draw();

  console.log(scene);
}

async function loadScene(url, grid) {
  let scene;
  try {
    State.scenes = await loaders.gltf(url, {
      ctx,
      includeCameras: !grid,
      includeAnimations: true,
      includeLights: !grid,
      dracoOptions: { transcoderPath: getURL("assets/decoders/draco/") },
      basisOptions: { transcoderPath: getURL("assets/decoders/basis/") },
    });
    State.scene = scene = State.scenes[0];
    State.scenes.forEach((scene) => (scene.url = url));
  } catch (e) {
    console.error(e);
    return e;
  }

  scene.entities.forEach((entity) => {
    if (entity.material) {
      entity.material.castShadows = State.shadows;
      entity.material.receiveShadows = State.shadows;
      if (entity.material.transmission) entity.material.cullFace = false;
    }

    world.add(entity);
  });

  // Add camera for models lacking one
  if (!grid) {
    cameraEntity = scene.entities.find((entity) => entity.camera);
    animationEntity = scene.entities.find(
      (entity) => entity.animation || entity.animations,
    );

    if (!cameraEntity) {
      const far = 10000;
      // TODO: "SimpleInstancing" needs aabbFromInstances
      const sceneBounds = scene.root.transform.worldBounds;
      const sceneCenter = aabb.center(scene.root.transform.worldBounds);

      if (isNaN(sceneCenter[0])) {
        sceneCenter[0] = 0;
        sceneCenter[1] = 0;
        sceneCenter[2] = 0;
      }

      const boundingSphereRadius = Math.max(
        ...sceneBounds.map((bound) => vec3.distance(sceneCenter, bound)),
      );
      const fov = Math.PI / 4;
      const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2);

      cameraEntity = createEntity({
        transform: components.transform({
          position: [sceneCenter[0], sceneCenter[1], Math.abs(distance)],
        }),
        camera: components.camera({
          near: 0.01,
          far,
          fov,
          aspect: ctx.width / ctx.height,
        }),
        orbiter: components.orbiter({
          element: ctx.canvas,
          target: sceneCenter,
          maxDistance: far,
        }),
      });
      scene.entities.push(cameraEntity);
      world.add(cameraEntity);

      if (State.selectedModel.name == "Fox") {
        cameraEntity.transform.position = [100, 100, 100];
        cameraEntity.transform.dirty = true;
      }
    } else {
      cameraEntity.camera.near = 0.5;
      cameraEntity.camera.aspect = ctx.width / ctx.height;
      cameraEntity.camera.dirty = true;

      // TODO: hardcoded
      if (!["MultiUVTest", "GearboxAssy"].includes(State.selectedModel.name)) {
        cameraEntity.orbiter = components.orbiter({
          // target: sceneCenter,
          // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
          element: ctx.canvas,
          minDistance: cameraEntity.camera.near,
          maxDistance: cameraEntity.camera.far,
        });
      }
    }
  }

  cameraEntity.postProcessing = postProcessingComponent;

  return scene;
}

async function renderModel(model, grid) {
  let format = State.formats[State.currentFormat];
  let modelFileName = model.variants[format];

  if (!modelFileName) {
    console.warn(
      `No format "${format}" supported for model ${model.name}. Defaulting to "glTF".`,
    );
    format = "glTF";
    modelFileName = model.variants["glTF"];
  }

  const url = `${MODELS_PATH}/${model.name}/${format}/${modelFileName}`;

  State.url = url;
  State.modelName = model.name;

  try {
    const scene = await loadScene(url, grid);
    onSceneLoaded(scene, grid);
  } catch (error) {
    console.error(error);
  }
}

const nextCamera = () => {
  const cameras = world.entities.filter((entity) => entity.camera);
  const next = cameras[(cameras.indexOf(cameraEntity) + 1) % cameras.length];

  if (next) {
    cameraEntity = next;
    cameraEntity.camera.dirty = true;
    cameraEntity.orbiter ||= components.orbiter({ element: ctx.canvas });
  }
};
const nextAnimation = () => {
  const animationsEntity = world.entities.find((entity) => entity.animations);
  if (animationsEntity) {
    const index = animationsEntity.animations.findIndex(
      (animation) => animation.playing,
    );
    animationsEntity.animations.forEach(
      (animation, i) =>
        (animation.playing =
          i === (index + 1) % animationsEntity.animations.length),
    );
  }
};
const nextScene = () => {
  const scenes = State.scenes;
  const next = scenes[(scenes.indexOf(State.scene) + 1) % scenes.length];

  if (!next || next === State.scene) return;

  // Camera is only ever pushed onto the first loaded scene's entities
  // (see loadScene); keep it alive across scenes instead of disposing it.
  world.dispose(
    State.scene.entities.filter((entity) => entity !== cameraEntity),
  );
  State.scene = next;
  next.entities.forEach((entity) => {
    if (entity !== cameraEntity) world.add(entity);
  });
  updateDefaultSky(next);

  if (State.helpers) {
    next.entities.forEach((entity) => {
      if (entity.geometry) {
        entity.boundingBoxHelper = components.boundingBoxHelper();
      }
      if (entity.skin) entity.skeletonHelper = components.skeletonHelper();
      if (entity.camera) entity.cameraHelper = components.cameraHelper();
    });
  }

  sceneGraphViz.init(next.entities);
  if (sceneGraphViz.isRendered()) sceneGraphViz.draw();
};
const nextMaterial = () => {};

const dispose = () => {
  // Clean up
  const scenes = State.scenes.length ? State.scenes : [State.scene];

  const entitiesIds = [
    ...scenes.map((scene) => scene?.entities.map((entity) => entity.id)).flat(),
    floorEntity?.id,
    cameraEntity?.id,
  ].filter(Boolean);

  world.dispose(
    world.entities.filter((entity) => entitiesIds.includes(entity.id)),
  );

  State.scenes = [];
};

// GUI
// Add screenshots to the GUI
const screenshots = await Promise.all(
  models.map(({ name, screenshot }) =>
    loadImage({
      url: `${MODELS_PATH}/${name}/${screenshot}`,
      crossOrigin: "anonymous",
    }),
  ),
);
const thumbnails = screenshots
  .map((img) => gpu.createTexture(ctx, { data: img, format: "rgba8unorm" }))
  .map((tex, i) => ({
    value: models[i],
    texture: tex,
  }));

gui.addColumn("GLTF");
gui.addParam("Model name", State, "modelName");
gui.addButton("Open Model URL", openModelURL);
gui.addTexture2DList(
  "Models",
  State,
  "selectedModel",
  thumbnails,
  5,
  async (model) => {
    dispose();

    await renderModel(model);
  },
);

gui.addColumn("Options");
gui.addRadioList(
  "Format",
  State,
  "currentFormat",
  State.formats.map((name, value) => ({
    name,
    value,
  })),
);
gui.addParam("Floor", State, "floor");
gui.addParam("Env map", State, "useEnvMap", null, () => {
  addEnvmap();
});
gui.addButton("Next camera", nextCamera);
gui.addButton("Next animation", nextAnimation);
gui.addButton("Next material", nextMaterial);
gui.addButton("Next scene", nextScene);

gui.addColumn("Debug");
gui.addFPSMeeter();
gui.addStats();
gui.addParam("Helpers", State, "helpers", null, () => {
  if (State.selectedModel) {
    dispose();
    renderModel(State.selectedModel);
  }
});
gui.addButton("Toggle Scene Graph", () => {
  sceneGraphViz.toggle();
});
gui.addButton("Tree", () => {
  debugSceneTree(world.entities);
});

// Filter models
models = models.filter(({ name }) =>
  [
    // "ABeautifulGame",
    // "AlphaBlendModeTest",
    // "AnimatedColorsCube", // FAIL: multiple scenes or animation?
    // "AnimatedCube",
    // "AnimatedMorphCube",
    // "AnimatedTriangle",
    // "AnimationPointerUVs", // FAIL: KHR_animation_pointer KHR_materials_anisotropy KHR_materials_iridescence
    // "AnisotropyBarnLamp", // FAIL: KHR_materials_anisotropy
    // "AnisotropyDiscTest", // FAIL: KHR_materials_anisotropy
    // "AnisotropyRotationTest", // FAIL: KHR_materials_anisotropy
    // "AnisotropyStrengthTest", // FAIL: KHR_materials_anisotropy
    // "AntiqueCamera",
    // "AttenuationTest",
    // "Avocado",
    // "BarramundiFish",
    // "BoomBox",
    // "BoomBoxWithAxes",
    // "Box",
    // "Box With Spaces",
    // "BoxAnimated",
    // "BoxInterleaved",
    // "BoxTextured",
    // "BoxTexturedNonPowerOfTwo",
    // "BoxVertexColors",
    // "BrainStem",
    // "Cameras",
    // "CarConcept",
    // "CarbonFibre", // FAIL: KHR_materials_anisotropy
    // "CesiumMan",
    // "CesiumMilkTruck",
    // "ChairDamaskPurplegold",
    // "ChronographWatch", // FAIL: KHR_materials_variants
    // "ClearCoatCarPaint",
    // "ClearCoatTest",
    // "ClearcoatWicker",
    // "CompareAlphaCoverage",
    // "CompareAmbientOcclusion",
    // "CompareAnisotropy", // FAIL: KHR_materials_anisotropy
    // "CompareBaseColor",
    // "CompareClearcoat",
    // "CompareDispersion",
    // "CompareEmissiveStrength",
    // "CompareIor",
    // "CompareIridescence", // FAIL: KHR_materials_iridescence
    // "CompareMetallic",
    // "CompareNormal",
    // "CompareRoughness",
    // "CompareSheen",
    // "CompareSpecular",
    // "CompareTransmission",
    // "CompareVolume",
    // "Corset",
    // "Cube",
    // "CubeVisibility", // FAIL: KHR_node_visibility, KHR_animation_pointer
    "DamagedHelmet",
    // "DiffuseTransmissionPlant", // HALF: depth check only works with DEPTH_COMPONENT16
    // "DiffuseTransmissionTeacup",
    // "DiffuseTransmissionTest",
    // "DirectionalLight", // FAIL: physical light energy preservation
    // "DispersionTest",
    // "DragonAttenuation", // FAIL: KHR_materials_variants
    // "DragonDispersion",
    // "Duck",
    // "EmissiveStrengthTest",
    // "EnvironmentTest",
    // "FlightHelmet",
    // "Fox", // HALF: hardcoded near/far
    // "GlamVelvetSofa", // FAIL: KHR_materials_variants
    // "GlassBrokenWindow",
    // "GlassHurricaneCandleHolder",
    // "GlassVaseFlowers",
    // "IORTestGrid",
    // "InterpolationTest",
    // "IridescenceAbalone", // FAIL: KHR_materials_iridescence
    // "IridescenceDielectricSpheres", // FAIL: KHR_materials_iridescence
    // "IridescenceLamp", // FAIL: KHR_materials_iridescence
    // "IridescenceMetallicSpheres", // FAIL: KHR_materials_iridescence
    // "IridescenceSuzanne", // FAIL: KHR_materials_iridescence
    // "IridescentDishWithOlives", // FAIL: KHR_materials_iridescence
    // "Lantern",
    // "LightsPunctualLamp",
    // "MandarinOrange",
    // "MaterialsVariantsShoe", // FAIL: KHR_materials_variants
    // "MeshPrimitiveModes",
    // "MetalRoughSpheres",
    // "MetalRoughSpheresNoTextures",
    // "MorphPrimitivesTest",
    // "MorphStressTest", // FAIL: needs animation texture
    // "MosquitoInAmber", // FAIL: TEXCOORD_2
    // "MultiUVTest", // FAIL: wrong position
    // "MultipleScenes",
    // "NegativeScaleTest",
    // "NodePerformanceTest",
    // "NormalTangentMirrorTest",
    // "NormalTangentTest",
    // "OrientationTest",
    // "PlaysetLightTest",
    // "PointLightIntensityTest", // FAIL: limit pixel
    // "PotOfCoals",
    // "PotOfCoalsAnimationPointer", // FAIL: KHR_animation_pointer
    // "PrimitiveModeNormalsTest", // FAIL: 3rd column should render as flat shading (need Generate tangents with Mikktspace?)
    // "RecursiveSkeletons",
    // "RiggedFigure",
    // "RiggedSimple",
    // "ScatteringSkull", // FAIL: KHR_materials_volume_scatter, KHR_xmp_json_ld
    // "SciFiHelmet",
    // "SheenChair",
    // "SheenCloth",
    // "SheenTestGrid",
    // "SheenWoodLeatherSofa",
    // "SimpleInstancing", // HALF: need instanced bbox
    // "SimpleMaterial",
    // "SimpleMeshes",
    // "SimpleMorph",
    // "SimpleSkin",
    // "SimpleSparseAccessor",
    // "SimpleTexture",
    // "SpecGlossVsMetalRough", // HALF: not in spec anymore
    // "SpecularSilkPouf",
    // "SpecularTest", // HALF: left column should have no specular but we disable extension if specular=0 in getProgramFlagsAndUniforms
    // "Sponza",
    // "StainedGlassLamp", // FAIL: KHR_materials_variants
    // "SunglassesKhronos", // FAIL: KHR_materials_iridescence
    // "Suzanne",
    // "TextureCoordinateTest",
    // "TextureEncodingTest",
    // "TextureLinearInterpolationTest", // HALF: EX_srgb in webgl1
    // "TextureSettingsTest",
    // "TextureTransformMultiTest",
    // "TextureTransformTest",
    // "ToyCar", // FAIL: (too small, wrong camera)
    // "TransmissionOrderTest",
    // "TransmissionRoughnessTest",
    // "TransmissionTest",
    // "TransmissionThinwallTestGrid",
    // "Triangle",
    // "TriangleWithoutIndices",
    // "TwoSidedPlane",
    // "Unicode❤♻Test",
    // "UnlitTest",
    // "VertexColorTest",
    // "VirtualCity", // FAIL: // "node_69" and "node_183" and "node_209" and "node_211" worldBounds infinity
    // "WaterBottle",
    // "XmpMetadataRoundedCube",
  ].includes(name),
);

const grid = models.length > 1;

// Setup for grid view
if (grid) {
  State.gridSize = Math.ceil(Math.sqrt(models.length));

  cameraEntity = createEntity({
    transform: components.transform({
      position: new Array(3).fill(State.gridSize * 2),
    }),
    camera: components.camera({
      aspect: ctx.width / ctx.height,
    }),
    orbiter: components.orbiter({ element: ctx.canvas }),
  });
  world.add(cameraEntity);

  if (State.floor) {
    floorEntity = createEntity({
      transform: components.transform({ position: [0, -0.6, 0] }),
      geometry: components.geometry(
        createCube({
          sx: 2 * State.gridSize,
          sy: 0.1,
          sz: 2 * State.gridSize,
        }),
      ),
      material: components.material({
        baseColor: [0.8, 0.8, 0.8, 1],
        metallic: 0,
        roughness: 1,
        castShadows: State.shadows,
        receiveShadows: State.shadows,
      }),
    });
    world.add(floorEntity);
  }
} else {
  State.selectedModel = models[0];
}

// Render scene(s)
for (const model of models) {
  await renderModel(model, grid);
}

window.addEventListener("resize", () => {
  gpu.resize(ctx, window.innerWidth, window.innerHeight, pixelRatio);
  if (cameraEntity) {
    cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
    cameraEntity.camera.dirty = true;
  }
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  if (cameraEntity) {
    renderEngine.update(world.entities);
    await renderEngine.render(world.entities, cameraEntity);
  }

  gui.draw();

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  window.dispatchEvent(new CustomEvent("screenshot"));
});
