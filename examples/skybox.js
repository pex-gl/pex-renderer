import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { loadHdr } from "pex-loaders";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import { sphere } from "primitive-geometry";

import { getURL, updateSunPosition } from "./utils.js";
import { getRenderPassGraphViz } from "./graph-viz.js";

const State = {
  envMap: false,
  ultraHdr: false,
  backgroundBlur: 0,
  rotation: 0,
  // rotation: 1.5 * Math.PI,
  maxElevation: 47,
  elevation: 47,
  azimuth: 0,
  progress: 0.5,
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, renderEngine.frameGraph);

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 0, 2] }),
  camera: components.camera({
    near: 0.1,
    far: 100,
  }),
  postProcessing: components.postProcessing(),
  controls: components.controls.orbit(),
});
world.add(cameraEntity);
console.log(cameraEntity);

const geometryEntity = createEntity({
  transform: components.transform({ position: [0, 0, 0] }),
  geometry: components.geometry(sphere()),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    roughness: 0,
    metallic: 1,
  }),
});
world.add(geometryEntity);

const ultraHdr = null;
// const ultraHdr = await getEnvMap(
//   ctx,
//   "assets/envmaps/Ditch-River_2k/Ditch-River_2k_0.9.jpg",
// );
const hdrMap = await loadHdr(
  ctx,
  getURL("assets/envmaps/Ditch-River_2k/Ditch-River_2k.hdr"),
);

const skyboxEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: components.skybox({
    sunPosition: [0, 0.05, -1],
    backgroundBlur: State.backgroundBlur,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyboxEntity);
updateSunPosition(skyboxEntity.skybox, State.elevation, State.azimuth);

const updateEnvMap = () => {
  skyboxEntity.skybox.envMap = State.envMap
    ? State.ultraHdr
      ? ultraHdr
      : hdrMap
    : null;
  skyboxEntity.reflectionProbe.dirty = true;
};

updateEnvMap();

// GUI
let guiEnvMapTextureControl;
const gui = createGUI(ctx);
gui.addColumn("Scene");
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});
gui.addLabel("Camera");
gui.addParam(
  "Exposure Compensation",
  cameraEntity.camera,
  "exposureCompensation",
  { min: -6, max: 6 },
);
gui.addLabel("Post-Processing");
gui.addParam("Grading Exposure", cameraEntity.postProcessing, "exposure", {
  min: -3,
  max: 3,
});
gui.addSeparator();
gui.addLabel("Material");
gui.addParam("Roughness", geometryEntity.material, "roughness");
gui.addParam("Metallic", geometryEntity.material, "metallic");

gui.addColumn("Skybox");
gui.addLabel("Environment");
gui.addParam("Intensity (lx)", skyboxEntity.skybox, "intensity", {
  min: 0,
  max: 100_000,
});
gui.addParam(
  "Rotation",
  State,
  "rotation",
  { min: 0, max: 2 * Math.PI },
  () => {
    quat.fromAxisAngle(
      skyboxEntity.transform.rotation,
      [0, 1, 0],
      State.rotation,
    );
    skyboxEntity.transform.dirty = true;
  },
);
gui.addParam("BG Blur", skyboxEntity.skybox, "backgroundBlur", {
  min: 0,
  max: 1,
});

gui.addSeparator();
gui.addLabel("Env Map");
gui.addParam("Enabled", State, "envMap", {}, (enabled) => {
  updateEnvMap();
});
gui.addParam("Ultra HDR", State, "ultraHdr", {}, (enabled) => {
  updateEnvMap();

  guiEnvMapTextureControl.options.flipY = enabled;
});

gui.addSeparator();
gui.addLabel("Sky");
gui.addParam(
  "Sun Progress",
  State,
  "progress",
  {
    min: 0,
    max: 1,
  },
  () => {
    State.elevation = State.maxElevation * Math.sin(Math.PI * State.progress);
    State.azimuth = 180 - 360 * State.progress;
    updateSunPosition(skyboxEntity.skybox, State.elevation, State.azimuth);
  },
);

gui.addParam(
  "Sun Elevation",
  State,
  "elevation",
  { min: 0, max: State.maxElevation },
  () => updateSunPosition(skyboxEntity.skybox, State.elevation, State.azimuth),
);
gui.addParam("Sun Azimuth", State, "azimuth", { min: -180, max: 180 }, () =>
  updateSunPosition(skyboxEntity.skybox, State.elevation, State.azimuth),
);
gui.addParam("Turbidity", skyboxEntity.skybox, "turbidity", {
  min: 0,
  max: 20,
});
gui.addParam("Rayleigh", skyboxEntity.skybox, "rayleigh", { min: 0, max: 4 });
gui.addParam("MieCoefficient", skyboxEntity.skybox, "mieCoefficient", {
  min: 0,
  max: 0.1,
});
gui.addParam("MieDirectionalG", skyboxEntity.skybox, "mieDirectionalG", {
  min: 0,
  max: 1,
});

gui.addColumn("Textures");
const dummyTexture2D = gpu.createTexture(ctx, {
  name: "dummyTexture2D",
  width: 256,
  height: 1,
  format: "rgba8unorm",
});
const guiSkyTextureControl = gui.addTexture2D("Sky", null, { flipY: true });
guiEnvMapTextureControl = gui.addTexture2D("Env Map", null, { flipY: false });
const dummyTextureCube = gpu.createTexture(ctx, {
  name: "dummyTextureCube",
  width: 1,
  height: 1,
  depth: 6,
  viewDimension: "cube",
  format: "rgba8unorm",
});
const guiSpecularTextureControl = gui.addTextureCube(
  "Specular Cubemap",
  dummyTextureCube,
  { level: 0 },
);
// One mip per roughness level: what the prefilter wrote for each.
gui.addParam("Specular Level", guiSpecularTextureControl.options, "level", {
  min: 0,
  max: 5,
});

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntity);

  guiSkyTextureControl.texture =
    skyboxEntity.skybox._skyTexture || dummyTexture2D;
  guiSkyTextureControl.options.exposure = Math.log2(
    (skyboxEntity.skybox._luminanceScale ?? 1) *
      (cameraEntity.camera._exposure ?? 1),
  );
  guiEnvMapTextureControl.texture =
    skyboxEntity.skybox.envMap || dummyTexture2D;
  guiSpecularTextureControl.texture =
    skyboxEntity._reflectionProbe?.specularTexture || dummyTextureCube;
  guiSpecularTextureControl.options.exposure = Math.log2(
    cameraEntity.camera._exposure ?? 1,
  );

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
