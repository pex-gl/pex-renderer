import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import random from "pex-random";
import { create, fromHex } from "pex-color";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";

import { cube } from "primitive-geometry";

import { getRenderPassGraphViz } from "./graph-viz.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, renderEngine.frameGraph);

const dutchPalette = [
  "#FFC312",
  "#F79F1F",
  "#EE5A24",
  "#EA2027",
  "#C4E538",
  "#A3CB38",
  "#009432",
  "#006266",
  "#12CBC4",
  "#1289A7",
  "#0652DD",
  "#1B1464",
  "#FDA7DF",
  "#D980FA",
  "#9980FA",
  "#5758BB",
  "#ED4C67",
  "#B53471",
  "#833471",
  "#6F1E51",
].map((c) => fromHex(create(), c));

const MAX_DEPTH = 8;

// returns array of rects [x, y, w, h, depth]
function divide(parent, rects) {
  rects.push(parent);

  const depth = parent[4];

  // var shouldDivide = random.chance(0.4 + 1 / (depth * 0.5 + 1))
  let shouldDivide = random.chance(0.3 + 1 / (depth / 10 + 1));
  if (depth <= 1) {
    shouldDivide = true;
  }

  if (depth >= MAX_DEPTH || !shouldDivide) {
    return rects;
  }

  if (parent[2] < 0.01 || parent[3] < 0.01) return rects;

  const numDivisions = random.int(2, 5);
  let horizontal = random.chance(0.5);
  if (depth === 0) horizontal = false;
  if (depth === 1) horizontal = true;

  for (let i = 0; i < numDivisions; i++) {
    let child = null;
    if (horizontal) {
      child = [
        parent[0] + (parent[2] * i * 1) / numDivisions,
        parent[1],
        (parent[2] * 1) / numDivisions,
        parent[3],
        depth + 1,
      ];
    } else {
      child = [
        parent[0],
        parent[1] + (parent[3] * i * 1) / numDivisions,
        parent[2],
        (parent[3] * 1) / numDivisions,
        depth + 1,
      ];
    }
    const offset = 0.002;
    child[0] += offset;
    child[1] += offset;
    child[2] -= 2 * offset;
    child[3] -= 2 * offset;
    divide(child, rects);
  }
  return rects;
}

const s = 1;
const rects = divide([-2 * s, -1 * s, 4 * s, 2 * s, 0], []);

// Entities
const postProcessing = components.postProcessing({
  // fxaa: components.postProcessing.fxaa(),
  // smaa: components.postProcessing.smaa(),
  ssao: components.postProcessing.ssao({
    type: "gtao",
    bentNormals: true,
    radius: 0.1,
  }),
  // exposure: 1.5,
  // dof: components.postProcessing.dof(),
});
const cameraEntity = createEntity({
  transform: components.transform({ position: [-3, 3, 3] }),
  camera: components.camera({
    aspect: ctx.width / ctx.height,
  }),
  orbiter: components.orbiter({ element: ctx.canvas }),
  postProcessing,
});
world.add(cameraEntity);

const floorEntity = createEntity({
  transform: components.transform({ position: [0, -0.05, 0] }),
  geometry: components.geometry(cube({ sx: 4, sy: 0.1, sz: 2 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(floorEntity);

const levelHeight = 0.04;
const geom = {
  ...cube(),
  offsets: {
    data: rects.map((rect) => [
      rect[0] + rect[2] / 2,
      levelHeight * (rect[4] + 0.5),
      rect[1] + rect[3] / 2,
    ]),
    stepMode: "instance",
  },
  scales: {
    data: rects.map(
      (
        rect, // return [rect[2] * Math.pow(0.9, rect[4]), levelHeight, rect[3] * Math.pow(0.9, rect[4])]
      ) => [rect[2], levelHeight, rect[3]],
    ),
    stepMode: "instance",
  },
  colors: {
    data: rects.map(() => {
      // return fromHSL(0.5 + random.float(0.1), 0.4, 0.4)
      if (random.chance(0.9)) return [1, 1, 1, 1];
      // if (random.chance(0.6)) return dutchPalette[1]
      // return dutchPalette[i % 12]
      // return dutchPalette[(8 + rect[4] * 2) % dutchPalette.length]
      // return dutchPalette[0 + rect[4] % 8]
      return random.element(dutchPalette);
    }),
    stepMode: "instance",
  },
  instances: rects.length,
};
const geomEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(geom),
  material: components.material({
    receiveShadows: true,
    castShadows: true,
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.2,
  }),
});
world.add(geomEntity);

const lightEntity = createEntity({
  transform: components.transform({
    position: [1, 2, 3],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([-5, -2, -3])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 1,
    castShadows: true,
    bias: 0.01,
  }),
});
world.add(lightEntity);

const numLights = 1;
for (let i = 0; i < numLights; i++) {
  const a = ((Math.PI * 2) / numLights) * i;
  const x = Math.cos(a);
  const y = 2;
  const z = Math.sin(a);

  const lightEntity = createEntity({
    transform: components.transform({
      position: [x, y, z],
      rotation: quat.fromDirection(quat.create(), [-x, -y, -z]),
    }),
    directionalLight: components.directionalLight({
      color: [1, 1, 1, 1],
      intensity: 1,
      castShadows: true,
      bias: 0.01,
    }),
  });
  world.add(lightEntity);
}

const skyboxEntity = createEntity({
  transform: components.transform(),
  skybox: components.skybox({ sunPosition: [0, 0.05, -1] }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  transform: components.transform(),
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbeEntity);

// GUI
const gui = createGUI(ctx);
gui.addColumn("Attachments");
gui.addFPSMeeter();
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});
gui.addRadioList(
  "Debug Render",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "standard-renderer",
  ),
  "debugRender",
  ["", "data.normalView", "data.ao"].map((value) => ({
    name: value || "No debug",
    value,
  })),
);
// renderEngine.renderers.find(
//   (renderer) => renderer.type == "standard-renderer"
// ).debugRender = "data.ao";

gui.addRadioList(
  "Debug Post-Processing",
  renderEngine.systems.find(
    (system) => system.type == "render-pipeline-system",
  ),
  "debugRender",
  [
    "",
    "ssao.main",
    "ssao.edges",
    "ssao.denoise[0]",
    "ssao.blurHorizontal",
    "ssao.blurVertical",
  ].map((value) => ({
    name: value || "No debug",
    value,
  })),
);

const guiNormalControl = gui.addTexture2D("Normal", null);
const guiDepthControl = gui.addTexture2D("Depth", null);
const guiAOControl = gui.addTexture2D("AO", null);
gui.addColumn("SSAO");
gui.addRadioList(
  "Type",
  postProcessing.ssao,
  "type",
  ["sao", "gtao"].map((value) => ({ name: value, value })),
);
gui.addParam("Radius", postProcessing.ssao, "radius", { min: 0, max: 5 });
gui.addParam("Mix", postProcessing.ssao, "mix", { min: 0, max: 1 });
gui.addParam("Brightness", postProcessing.ssao, "brightness", {
  min: -0.5,
  max: 0.5,
});
gui.addParam("Contrast", postProcessing.ssao, "contrast", { min: 0.1, max: 3 });

gui.addColumn("GTAO");
gui.addParam("Slices", postProcessing.ssao, "slices", {
  min: 1,
  max: 9,
  step: 1,
});
gui.addParam("Steps per slice", postProcessing.ssao, "samples", {
  min: 1,
  max: 9,
  step: 1,
});
gui.addParam("Bent normals", postProcessing.ssao, "bentNormals");
gui.addParam("Radius multiplier", postProcessing.ssao, "radiusMultiplier", {
  min: 0.3,
  max: 3,
});
gui.addParam("Falloff range", postProcessing.ssao, "falloffRange", {
  min: 0,
  max: 1,
});
gui.addParam(
  "Sample distribution",
  postProcessing.ssao,
  "sampleDistributionPower",
  { min: 1, max: 3 },
);
gui.addParam("Thin occluder", postProcessing.ssao, "thinOccluderCompensation", {
  min: 0,
  max: 0.7,
});
gui.addParam("Final value power", postProcessing.ssao, "finalValuePower", {
  min: 0.5,
  max: 5,
});
gui.addParam(
  "Depth mip offset",
  postProcessing.ssao,
  "depthMipSamplingOffset",
  {
    min: 0,
    max: 10,
  },
);
gui.addParam("Denoise passes", postProcessing.ssao, "denoisePasses", {
  min: 0,
  max: 3,
  step: 1,
});
gui.addParam("Denoise blur beta", postProcessing.ssao, "denoiseBlurBeta", {
  min: 0.5,
  max: 5,
});

gui.addColumn("SAO");
gui.addParam("Samples", postProcessing.ssao, "samples", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addParam("Spiral turns", postProcessing.ssao, "spiralTurns", {
  min: 1,
  max: 17,
  step: 1,
});
gui.addParam("Intensity", postProcessing.ssao, "intensity", {
  min: 0,
  max: 10,
});
gui.addParam("Bias", postProcessing.ssao, "bias", { min: 0, max: 0.1 });
gui.addParam("Blur radius", postProcessing.ssao, "blurRadius", {
  min: 0,
  max: 5,
});
gui.addParam("Blur sharpness", postProcessing.ssao, "blurSharpness", {
  min: 0,
  max: 20,
});

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

const dummyTexture2D = gpu.createTexture(ctx, {
  name: "dummyTexture2D",
  width: 160,
  height: 1,
  format: "rgba8unorm",
});
let aoHandle;
renderEngine.frameGraph.on("present", (textures) => {
  aoHandle = textures.get("ssao.main");
  if (aoHandle) renderEngine.frameGraph.exportTexture(aoHandle);
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  const [{ color, normal, depth }] = await renderEngine.render(
    world.entities,
    cameraEntity,
  );

  guiNormalControl.texture = normal || dummyTexture2D;
  guiDepthControl.texture = depth || dummyTexture2D;
  guiAOControl.texture =
    (aoHandle && renderEngine.frameGraph.resolve(aoHandle)) || dummyTexture2D;

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
