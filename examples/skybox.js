import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";

import { sphere } from "primitive-geometry";

import { getEnvMap, updateSunPosition } from "./utils.js";

const State = {
  envMap: false,
  backgroundBlur: 0,
  rotation: 0,
  // rotation: 1.5 * Math.PI,
  sizeIndex: 4,
  sizes: [256, 512, 1024, 2048, 4096],
  maxElevation: 30,
  elevation: 0,
  azimuth: -180,
  progress: 0,
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 0, 2] }),
  camera: components.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
    exposure: 1,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

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

const envMap = await getEnvMap(
  ctx,
  "assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr",
);

const skyboxEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: components.skybox({
    sunPosition: [0, 0.05, -1],
    backgroundBlur: State.backgroundBlur,
    envMap: State.envMap ? envMap : false,
    exposure: 1,
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: components.reflectionProbe({
    // rgbm: false,
    size: State.sizes[State.sizeIndex],
  }),
});
world.add(reflectionProbeEntity);

// Update for GUI
renderEngine.update(world.entities);
renderEngine.render(world.entities, cameraEntity);

// GUI
const gui = createGUI(ctx);
gui.addColumn("Scene");
gui.addLabel("Camera");
gui.addParam("Camera Exposure", cameraEntity.camera, "exposure", {
  min: 0,
  max: 5,
});
gui.addSeparator();
gui.addLabel("Material");
gui.addParam("Roughness", geometryEntity.material, "roughness");
gui.addParam("Metallic", geometryEntity.material, "metallic");

gui.addColumn("Skybox");

gui.addParam("EnvMap", State, "envMap", {}, (enabled) => {
  skyboxEntity.skybox.envMap = enabled ? envMap : null;
});
gui.addParam("BG Blur", skyboxEntity.skybox, "backgroundBlur");
gui.addParam("Exposure", skyboxEntity.skybox, "exposure", {
  min: 0,
  max: 5,
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
    reflectionProbeEntity.reflectionProbe.dirty = true;
  },
);
gui.addSeparator();
gui.addLabel("Sky Texture");

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
    State.azimuth = 360 * State.progress - 180;
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
updateSunPosition(skyboxEntity.skybox, State.elevation, State.azimuth);
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

gui.addSeparator();
gui.addLabel("Environment Map");
gui.addRadioList(
  "Map Size",
  State,
  "sizeIndex",
  State.sizes.map((name, value) => ({
    name,
    value,
  })),
  () => {
    reflectionProbeEntity.reflectionProbe.size = State.sizes[State.sizeIndex];
  },
);

gui.addColumn("Textures");
const dummyTexture2D = ctx.texture2D({
  name: "dummyTexture2D",
  width: 256,
  height: 1,
});
const guiSkyTextureControl = gui.addTexture2D("Sky", null, { flipY: true });
const guiEnvMapTextureControl = gui.addTexture2D("Env Map", null);
gui.addTextureCube(
  "Reflection Cubemap",
  reflectionProbeEntity._reflectionProbe._dynamicCubemap,
);
// gui.addTexture2D(
//   "Oct Map",
//   reflectionProbeEntity._reflectionProbe._octMap,
// );
gui.addTexture2D(
  "Reflection Map",
  reflectionProbeEntity._reflectionProbe._reflectionMap,
);

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  guiSkyTextureControl.texture =
    skyboxEntity.skybox._skyTexture || dummyTexture2D;
  guiEnvMapTextureControl.texture =
    skyboxEntity.skybox.envMap || dummyTexture2D;

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
