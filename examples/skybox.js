import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import { sphere } from "primitive-geometry";

import { getEnvMap, getURL } from "./utils.js";

const State = {
  envMap: true,
  rotation: 1.5 * Math.PI,
  sizeIndex: 4,
  sizes: [256, 512, 1024, 2048, 4096],
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
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
    envMap: State.envMap ? envMap : false,
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
gui.addColumn("Settings");
if (skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap) {
  gui.addTexture2D(
    "Skybox",
    skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap,
  );
}
gui.addParam("EnvMap", State, "envMap", {}, (enabled) => {
  skyboxEntity.skybox.envMap = enabled ? envMap : null;
});
gui.addParam("BG Blur", skyboxEntity.skybox, "backgroundBlur");
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

gui.addSeparator();
gui.addLabel("Material");
gui.addParam("Roughness", geometryEntity.material, "roughness");
gui.addParam("Metallic", geometryEntity.material, "metallic");

gui.addColumn("Textures");
gui.addTextureCube(
  "Cubemap",
  reflectionProbeEntity._reflectionProbe._dynamicCubemap,
);
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

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
