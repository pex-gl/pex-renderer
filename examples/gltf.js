import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { loadJson, loadImage, loadArrayBuffer } from "pex-io";
import { quat, vec3, mat4 } from "pex-math";
import { aabb } from "pex-geom";

import { cube as createCube } from "primitive-geometry";

import { debugSceneTree, getEnvMap, getURL } from "./utils.js";

const MODELS_PATH =
  location.hostname === "localhost"
    ? "examples/glTF-Sample-Assets/Models"
    : "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";

// const MODELS_PATH =
//   "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models";

let models = await loadJson(`${MODELS_PATH}/model-index.json`);

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: "",
  scenes: [],
  gridSize: 1,
  boundingBoxes: true,
  floor: false,
  useEnvMap: true,
  shadows: false,
  graphViz: false,
  formats: Array.from(
    models.reduce(
      (formats, model) => new Set([...formats, ...Object.keys(model.variants)]),
      new Set(),
    ),
  ).filter((format) => !["glTF-IBL", "glTF-Meshopt"].includes(format)),
  currentFormat: 5,
  modelName: "-",
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });

const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld({ systems: renderEngine.systems });

// prettier-ignore
const legacySpecularGlossinessFlagDefinitions = [
  [["material", "diffuse"], "USE_SPECULAR_GLOSSINESS_WORKFLOW", { uniform: "uDiffuse" }],
  [["material", "specular"], "", { uniform: "uSpecular", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
  [["material", "glossiness"], "", { uniform: "uGlossiness", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
  [["material", "diffuseTexture"], "DIFFUSE_TEXTURE", { type: "texture", uniform: "uDiffuseTexture", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
  [["material", "specularGlossinessTexture"], "SPECULAR_GLOSSINESS_TEXTURE", { type: "texture", uniform: "uSpecularGlossinessTexture", requires: "USE_SPECULAR_GLOSSINESS_WORKFLOW" }],
];

renderEngine.renderers
  .find((renderer) => renderer.type == "standard-renderer")
  .flagDefinitions.push(...legacySpecularGlossinessFlagDefinitions);

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
    bias: 0.2,
  }),
});
world.add(sunEntity);

const skyEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromEuler(quat.create(), [0, -Math.PI / 2, 0]),
  }),
  skybox: components.skybox({
    sunPosition: [0.1, 0.04, -1],
    backgroundBlur: true,
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
    if (!envMap) {
      envMap = await getEnvMap(
        ctx,
        // `assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`
        // `assets/envmaps/garage/garage.hdr`,
        // `assets/envmaps/Footprint Court/footprint_court.hdr`,
        `assets/envmaps/Artist Workshop/artist_workshop_2k.hdr`,
        // `assets/envmaps/Colorful_Studio.hdr`
      );
    }
    skyEntity.skybox.envMap = envMap;
  } else {
    skyEntity.skybox.envMap = null;
  }
};
addEnvmap();

const axesEntity = createEntity({ axesHelper: {} });
world.add(axesEntity);

// Utils
let debugOnce = false;

function openModelURL() {
  window.open(
    State.url.replace(
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/master/2.0/",
      "https://github.com/KhronosGroup/glTF-Sample-Assets/blob/master/2.0/",
    ),
  );
}

async function renderGraphViz() {
  const { default: dot } = await import("./graph-viz.js");
  dot.reset();

  State.scenes[0].entities.forEach((entity) => {
    dot.node(
      entity.id,
      `${entity.transform.depth ?? "?"}: ${entity.name || "Entity"} (${
        entity.id
      })`,
    );
    const parent = entity.transform.parent;
    if (parent) dot.edge(parent.entity.id, entity.id);
  });

  dot.render();
}

// glTF
function repositionModel({ root }) {
  const n = State.gridSize;
  const i = State.scenes.length;
  const x = 2 * (i % n) - n + 1;
  const z = 2 * Math.floor(i / n) - n + 1;

  vec3.add(root.transform.position, [x, 0, z]);
}

function aabbFromInstances(geom, offsets) {
  const bounds = aabb.fromPoints(aabb.create(), offsets);
  const geomBounds = aabb.fromPoints(aabb.create(), geom.positions);
  vec3.add(bounds[0], geomBounds[0]);
  vec3.add(bounds[1], geomBounds[1]);
  return bounds;
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
    root.root = true;
    root.transform.scale = [sceneScale, sceneScale, sceneScale];
    root.transform.dirty = true;
  }
}

function onSceneLoaded(scene, grid) {
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

  if (State.boundingBoxes) {
    scene.entities.forEach((entity) => {
      if (entity.geometry) {
        entity.boundingBoxHelper = components.boundingBoxHelper();
      }
    });
  }

  if (State.graphViz) renderGraphViz();

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
      // Update needed for transform.worldBounds
      // renderEngine.systems
      //   .find((system) => system.type === "transform-system")
      //   .update(scene.entities);
      // renderEngine.update(scene.entities);
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
          // position: [2, 2, 2],
          position: [sceneCenter[0], sceneCenter[1], Math.abs(distance)],
        }),
        camera: components.camera({
          near: 0.01,
          far,
          fov,
          aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
        }),
        orbiter: components.orbiter({
          element: ctx.gl.canvas,
          target: sceneCenter,
          // distance,
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
      //TODO: do i need to set dirty for camera to update?
      cameraEntity.camera.near = 0.5;
      cameraEntity.camera.aspect =
        ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
      // cameraEntity.camera.projectionMatrix = mat4.perspective(
      //   mat4.create(),
      //   cameraEntity.camera.fov,
      //   cameraEntity.camera.aspect,
      //   cameraEntity.camera.near,
      //   cameraEntity.camera.far
      // );
      cameraEntity.camera.dirty = true;

      // TODO: hardcoded
      if (!["MultiUVTest", "GearboxAssy"].includes(State.selectedModel.name)) {
        cameraEntity.orbiter = components.orbiter({
          element: ctx.gl.canvas,
          // target: sceneCenter,
          // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
          minDistance: cameraEntity.camera.near,
          maxDistance: cameraEntity.camera.far,
        });
      }
    }
  }

  // if (["EmissiveStrengthTest"].includes(State.selectedModel.name)) {
  //   cameraEntity.postProcessing = postProcessingComponent;
  // } else {
  //   delete cameraEntity.postProcessing;
  // }
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
    cameraEntity.orbiter ||= components.orbiter({ element: ctx.gl.canvas });
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

  if (next) {
    console.log(next);
  }
};
const nextMaterial = () => {};

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
  .map((img) =>
    ctx.texture2D({
      data: img,
      width: img.width,
      height: img.height,
      encoding: ctx.Encoding.SRGB,
      pixelFormat: ctx.PixelFormat.RGBA8,
      flipY: true,
    }),
  )
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
  4,
  async (model) => {
    // Clean up
    const scenes = State.scenes.length ? State.scenes : [State.scene];

    const entitiesIds = [
      ...scenes
        .map((scene) => scene?.entities.map((entity) => entity.id))
        .flat(),
      floorEntity?.id,
      cameraEntity?.id,
    ].filter(Boolean);

    world.dispose(
      world.entities.filter((entity) => entitiesIds.includes(entity.id)),
    );

    // TODO renderEngine resourceCache dispose cache

    State.scenes = [];

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
gui.addParam("Bounding Box", State, "boundingBoxes");
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
gui.addParam("Graph viz", State, "graphViz");
gui.addButton("Tree", () => {
  debugSceneTree(world.entities);
  if (State.graphViz) renderGraphViz();
});

// Filter models
models = models.filter(({ name }) =>
  [
    // "ABeautifulGame",
    // "AlphaBlendModeTest",
    // "AnimatedCube",
    // "AnimatedMorphCube",
    // "AnimatedTriangle",
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
    // "BoxVertexColors", // FAIL: COLOR_0 can be vec3
    // "BrainStem",
    // "Cameras",
    // "CarbonFibre", // FAIL: KHR_materials_anisotropy
    // "CesiumMan",
    // "CesiumMilkTruck",
    // "ChairDamaskPurplegold",
    // "ClearCoatCarPaint",
    // "ClearCoatTest",
    // "ClearcoatWicker",
    // "Corset",
    // "Cube",
    "DamagedHelmet",
    // "DiffuseTransmissionPlant", // FAIL: KHR_materials_diffuse_transmission
    // "DiffuseTransmissionTeacup", // FAIL: KHR_materials_diffuse_transmission
    // "DirectionalLight", // FAIL: physical light energy preservation
    // "DispersionTest",
    // "DragonAttenuation", // FAIL: KHR_materials_variants
    // "DragonDispersion",
    // "Duck",
    // "EmissiveStrengthTest",
    // "EnvironmentTest", // HALF: missing glTF-IBL
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
    // "MandarinOrange", // FAIL: KHR_materials_diffuse_transmission
    // "MaterialsVariantsShoe", // FAIL: KHR_materials_variants
    // "MeshPrimitiveModes",
    // "MetalRoughSpheres",
    // "MetalRoughSpheresNoTextures",
    // "MorphPrimitivesTest",
    // "MorphStressTest", // FAIL: needs animation texture
    // "MosquitoInAmber", // FAIL: TEXCOORD_2
    // "MultiUVTest", // FAIL: wrong position
    // "MultipleScenes", // FAIL: missing implementation
    // "NegativeScaleTest", // FAIL: need determinant test
    // "NormalTangentMirrorTest",
    // "NormalTangentTest",
    // "OrientationTest",
    // "PotOfCoals",
    // "PrimitiveModeNormalsTest", // FAIL: 3rd column should render as flat shading
    // "RecursiveSkeletons",
    // "RiggedFigure",
    // "RiggedSimple",
    // "SciFiHelmet",
    // "SheenChair",
    // "SheenCloth",
    // "SheenTestGrid",
    // "SimpleInstancing", // HALF: need instanced bbox
    // "SimpleMaterial",
    // "SimpleMeshes",
    // "SimpleMorph",
    // "SimpleSkin",
    // "SimpleSparseAccessor",
    // "SimpleTexture",
    // "SpecGlossVsMetalRough", // HALF: not in spec anymore
    // "SpecularSilkPouf",
    // "SpecularTest", // HALF: left column should have no specular
    // "Sponza",
    // "StainedGlassLamp", // FAIL: KHR_materials_variants
    // "Suzanne",
    // "TextureCoordinateTest",
    // "TextureEncodingTest",
    // "TextureLinearInterpolationTest", // HALF: EX_srgb in webgl1
    // "TextureSettingsTest",
    // "TextureTransformMultiTest",
    // "TextureTransformTest",
    // "ToyCar", // FAIL: (too small, wrong camera)
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
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
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
  ctx.set({
    pixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  if (cameraEntity) {
    cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
    cameraEntity.camera.dirty = true;
  }
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;

  if (cameraEntity) {
    renderEngine.update(world.entities);
    renderEngine.render(world.entities, cameraEntity);
  }

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
