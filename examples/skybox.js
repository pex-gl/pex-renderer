import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import * as io from "pex-io";
import { quat } from "pex-math";
import createGUI from "pex-gui";
import { sphere } from "primitive-geometry";
import parseHdr from "parse-hdr";

import { getURL } from "./utils.js";

const {
  camera,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const State = {
  envMap: true,
  rotation: 1.5 * Math.PI,
  sizeIndex: 4,
  sizes: [256, 512, 1024, 2048, 4096],
};

const ctx = createContext({ pixelRatio: devicePixelRatio });

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx, { scale: 1 });

const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 2] }),
  camera: camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
  }),
  orbiter: orbiter(),
});
world.add(cameraEntity);

const geometryEntity = createEntity({
  transform: transform({ position: [0, 0, 0] }),
  geometry: geometry(sphere()),
  material: material({
    baseColor: [1, 1, 1, 1],
    roughness: 0,
    metallic: 1,
  }),
});
world.add(geometryEntity);

const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
    // getURL(`assets/envmaps/brown_photostudio_02_8k.hdr`)
    // getURL(`assets/envmaps/garage/garage.hdr`)
  )
);
const envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  flipY: true,
});

const skyboxEntity = createEntity({
  transform: transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation),
  }),
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
    envMap,
  }),
});
world.add(skyboxEntity);

if (State.envMap) {
  skyboxEntity.skybox.envMap = envMap;
}

const reflectionProbeEntity = createEntity({
  reflectionProbe: reflectionProbe({
    // rgbm: false,
    size: State.sizes[State.sizeIndex],
  }),
});
world.add(reflectionProbeEntity);
window.reflectionProbeEntity = reflectionProbeEntity;

// Update for GUI
renderEngine.update(world.entities);
renderEngine.render(world.entities, cameraEntity);

// GUI
gui.addColumn("Settings");
if (skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap) {
  gui.addTexture2D(
    "Skybox",
    skyboxEntity.skybox.texture || skyboxEntity.skybox.envMap
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
      State.rotation
    );
    skyboxEntity.transform = { ...skyboxEntity.transform };
    reflectionProbeEntity.reflectionProbe.dirty = true;
  }
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
  }
);

gui.addSeparator();
gui.addLabel("Material");
gui.addParam("Roughness", geometryEntity.material, "roughness");
gui.addParam("Metallic", geometryEntity.material, "metallic");

gui.addColumn("Textures");
gui.addTextureCube(
  "Cubemap",
  reflectionProbeEntity._reflectionProbe._dynamicCubemap
);

gui.addTexture2D(
  "Reflection Map",
  reflectionProbeEntity._reflectionProbe._reflectionMap
);
// gui.addTexture2D("Octmap", reflectionProbeEntity._reflectionProbe._octMap);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
