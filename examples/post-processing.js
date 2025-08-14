import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { mat4, quat, vec3 } from "pex-math";
import { aabb } from "pex-geom";
import random from "pex-random";
import createGUI from "pex-gui";
import * as SHADERS from "pex-shaders";

import { cube, roundedCube, capsule, sphere } from "primitive-geometry";

import { dragon, getEnvMap, getTexture, getURL } from "./utils.js";

random.seed(14);

const State = {
  enabled: true,

  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],

  aa: true,
  ssao: true,
  fog: false,
  bloom: true,
  dof: true,
  lut: true,
  colorCorrection: true,
  vignette: true,
  filmGrain: true,
};

// const pixelRatio = devicePixelRatio;
const pixelRatio = 1;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const helperEntity = createEntity({
  transform: components.transform({ position: [0, 0.01, 0] }),
  axesHelper: components.axesHelper(),
  gridHelper: components.gridHelper(),
});
world.add(helperEntity);
// Scale scene to macro, 1m -> 5cm
const s = 1;
// const s = 0.05;
const scene = createEntity({
  transform: components.transform({ scale: [s, s, s] }),
});

world.add(scene);

// Geometry
const dragonBounds = aabb.create();
aabb.fromPoints(dragonBounds, dragon.positions);

// Camera
const camera = components.camera({
  // fov: Math.PI / 6,
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  exposure: 1,
  fStop: 4,
});
const postProcessing = components.postProcessing({
  dof: {
    type: "gustafsson", // upitis
    physical: true,
    focusDistance: 7,
    focusScale: 1,
    samples: 6,
    focusOnScreenPoint: false,
    screenPoint: [0.5, 0.5],
    chromaticAberration: 0.7,
    luminanceThreshold: 0.7,
    luminanceGain: 1,
    shape: "disk",
    debug: false,
  },
  aa: {
    msaa: false,
    type: "fxaa",
    quality: 2,
    subPixelQuality: 0.75,
  },
  ssao: {
    type: "sao", // "gtao",
    noiseTexture: true,
    mix: 1,
    // samples: options?.type === "gtao" ? 6 : 11,
    samples: 11,
    intensity: 2.2,
    radius: 0.5,
    bias: 0.001, // cm
    blurRadius: 0.5,
    blurSharpness: 10,
    brightness: 0,
    contrast: 1,
    // SAO
    spiralTurns: 7,
    // GTAO
    slices: 3,
    colorBounce: true,
    colorBounceIntensity: 1.0,
  },
  fog: {
    color: [0.5, 0.5, 0.5],
    start: 5,
    density: 0.15,

    sunPosition: [1, 1, 1],
    sunDispertion: 0.2,
    sunIntensity: 0.1,
    sunColor: [0.98, 0.98, 0.7],
    inscatteringCoeffs: [0.3, 0.3, 0.3],
  },
  bloom: {
    quality: 1,
    colorFunction: "luma",
    threshold: 1,
    source: false,
    radius: 1,
    intensity: 0.1,
  },
  lut: {
    texture: await getTexture(
      ctx,
      getURL(`assets/textures/lut/lookup-autumn.png`),
      ctx.Encoding.Linear,
      {
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Nearest,
        mipmap: false,
        flipY: false,
        aniso: 0,
        pixelFormat: ctx.PixelFormat.RGBA32F,
      },
    ),
  },
  colorCorrection: {
    brightness: 0,
    contrast: 1,
    saturation: 1,
    hue: 0,
  },
  vignette: {
    radius: 0.8,
    intensity: 0.2,
  },
  filmGrain: {
    quality: 2,
    size: 1.6,
    intensity: 0.05,
    colorIntensity: 0.6,
    luminanceIntensity: 1,
    speed: 0.5,
  },
  opacity: 1,
});
const cameraY = s * 1;
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, cameraY, s * 10] }),
  camera,
  orbiter: components.orbiter({
    element: ctx.gl.canvas,
    target: [0, cameraY, 0],
  }),
  postProcessing,
});
world.add(cameraEntity);

// Meshes
const baseColorTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_basecolor.png`),
  ctx.Encoding.SRGB,
);
const normalTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_n.png`),
);
const metallicTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_metallic.png`),
);
const roughnessTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_roughness.png`),
);
const emissiveColorTexture = await getTexture(
  ctx,
  getURL(`assets/materials/plastic-glow.material/plastic-glow_emissive.png`),
  ctx.Encoding.SRGB,
);
const geometries = [
  capsule({ radius: 0.25 }),
  roundedCube({ sx: 0.75, nx: 20, radius: 0.2 }),
  sphere({ radius: 0.3 }),
];

// Ground
const floorEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, -0.02 / 2, 0],
  }),
  geometry: components.geometry(cube({ sx: 10, sy: 0.02, sz: 10 })),
  material: components.material({
    baseColor: [0.15, 0.15, 0.2, 1.0],
    roughness: 1,
    metallic: 0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(floorEntity);

const backgroundStuffParent = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, 0, 0],
    scale: [1, 1, 1],
  }),
});
world.add(backgroundStuffParent);

// Black Spheres
for (let i = 0; i < 20; i++) {
  const sphereEntity = createEntity({
    transform: components.transform({
      parent: backgroundStuffParent.transform,
      position: vec3.add(random.vec3(), [0, 1, 0]),
    }),
    geometry: components.geometry(geometries[2]),
    material: components.material({
      baseColor: [0.07, 0.06, 0.0, 1.0],
      roughness: 0.2,
      metallic: 0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  world.add(sphereEntity);
}

const dragonScale = 3;
const dragonEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [0, -dragonBounds[0][1] * dragonScale, 2.5],
    scale: new Array(3).fill(dragonScale),
  }),
  geometry: components.geometry(dragon),
  material: components.material({
    baseColor: [0.8, 0.8, 0.8, 1.0],
    roughness: 1,
    metallic: 0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(dragonEntity);

const heights = [2.5, 1.4, 0.5];
// Capsules, rounded cubes, spheres
for (let j = -5; j <= 5; j += 2) {
  geometries.forEach((geometry, i) => {
    const x = j * 0.6;
    let y = heights[i];
    const z = 0;
    const entity = createEntity({
      transform: components.transform({
        parent: backgroundStuffParent.transform,
        position: [x, y, z],
      }),
      geometry: components.geometry(geometry),
      material: components.material({
        baseColor: [0.9, 0.9, 0.9, 1],
        roughness: (j + 5) / 10,
        metallic: 0.0, // 0.01, // (j + 5) / 10,
        baseColorTexture,
        roughnessTexture,
        emissiveColorTexture,
        metallicTexture,
        normalTexture,
        castShadows: true,
        receiveShadows: true,
      }),
    });
    world.add(entity);
  });
}

// Lights
const pointLightEntity = createEntity({
  transform: components.transform({
    parent: scene.transform,
    position: [2, 2, 2],
  }),
  geometry: components.geometry(sphere({ radius: 0.1 })),
  material: components.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1],
  }),
  pointLight: components.pointLight({
    color: [1, 0, 0, 1],
    intensity: 10,
    range: 10,
    castShadows: true,
  }),
});
world.add(pointLightEntity);

const areaLightEntity = createEntity({
  transform: components.transform({
    parent: backgroundStuffParent.transform,
    position: [0, 3.5, 0],
    scale: [5, 1, 0.1],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([0, -1, 0.001])),
  }),
  geometry: components.geometry(cube()),
  material: components.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [2.0, 1.2, 0.1, 1],
  }),
  areaLight: components.areaLight({
    color: [2.0, 1.2, 0.1, 1],
    intensity: 2,
    castShadows: true,
  }),
});
world.add(areaLightEntity);

// Sky
const sunEntity = createEntity({
  transform: components.transform({
    position: [0, 1, -5],
    rotation: quat.fromDirection(
      quat.create(),
      vec3.normalize(vec3.scale(vec3.copy([0, 1, -5]), -1)),
    ),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2,
    castShadows: true,
    bias: 0.01,
  }),
});
world.add(sunEntity);

const skyboxEntity = createEntity({
  transform: components.transform(),
  skybox: components.skybox({
    backgroundBlur: false,
    envMap: await getEnvMap(ctx, "assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
  }),
  reflectionProbe: components.reflectionProbe({}),
});
world.add(skyboxEntity);

renderEngine.systems
  .find(({ type }) => type === "transform-system")
  .sort(world.entities);

// GUI
const gui = createGUI(ctx);
gui.addColumn("Attachments");
gui.addFPSMeeter();
State.msg = "";
gui.addRadioList(
  "Debug Render",
  renderEngine.renderers.find(
    (renderer) => renderer.type == "standard-renderer",
  ),
  "debugRender",
  ["", "data.normalView", "data.emissiveColor", "data.ao"].map((value) => ({
    name: value || "No debug",
    value,
  })),
);

gui.addRadioList(
  "Debug Post-Processing",
  renderEngine.systems.find(
    (system) => system.type == "render-pipeline-system",
  ),
  "debugRender",
  ["", "ssao.main", "dof.main", "bloom.threshold", "bloom.downsample[3]"].map(
    (value) => ({
      name: value || "No debug",
      value,
    }),
  ),
);
const dummyTexture2D = ctx.texture2D({
  name: "dummyTexture2D",
  width: 4,
  height: 4,
});
const guiNormalControl = gui.addTexture2D("Normal", null, { flipY: true });
const guiDepthControl = gui.addTexture2D("Depth", null, { flipY: true });
const guiAOControl = gui.addTexture2D("Ao", null, { flipY: true });

gui.addParam("Background Blur", skyboxEntity.skybox, "backgroundBlur");

// gui.addColumn("Material");
// gui.addParam("Base Color", State, "baseColor", { type: "color" }, () => {
//   entities.forEach((entity) => {
//     entity.material = { baseColor: State.baseColor };
//   });
// });
// gui.addParam("Roughness", State, "roughness", {}, () => {
//   entities.forEach((entity) => {
//     entity.material = { roughness: State.roughness };
//   });
// });
// gui.addParam("Metallic", State, "metallic", {}, () => {
//   entities.forEach((entity) => {
//     entity.material = { metallic: State.metallic };
//   });
// });

// // PostProcess
// const postProcessTab = gui.addTab("PostProcess");
// postProcessTab.setActive();
gui.addColumn("Post-Processing");
gui.addParam("Enabled", State, "enabled", null, () => {
  if (State.enabled) {
    cameraEntity.postProcessing = postProcessing;
  } else {
    delete cameraEntity.postProcessing;
  }
});
const enablePostProPass = (name) => {
  if (State[name]) {
    if (State[`_${name}`]) postProcessing[name] = State[`_${name}`];
  } else {
    State[`_${name}`] = postProcessing[name];
    delete postProcessing[name];
  }
};
gui.addParam("AA", State, "aa", null, () => {
  enablePostProPass("aa");
});
gui.addParam("MSAA", postProcessing.aa, "msaa");
gui.addRadioList(
  "Type",
  postProcessing.aa,
  "type",
  ["none", "fxaa"].map((value) => ({ name: value, value })),
);
gui.addParam("Quality", postProcessing.aa, "quality", {
  min: 0,
  max: 4,
  step: 1,
});
gui.addParam("SubPixelQuality", postProcessing.aa, "subPixelQuality", {
  min: 0,
  max: 1,
  step: 0.25,
});
gui.addParam("Fog", State, "fog", null, () => {
  enablePostProPass("fog");
});
gui.addParam("Fog color", postProcessing.fog, "color");
gui.addParam("Fog start", postProcessing.fog, "start", { min: 0, max: 10 });
gui.addParam("Fog density", postProcessing.fog, "density");

gui.addParam("LUT", State, "lut", null, () => {
  enablePostProPass("lut");
});

gui.addParam("ColorCorrection", State, "colorCorrection", null, () => {
  enablePostProPass("colorCorrection");
});
gui.addParam(
  "ColorCorrection brightness",
  postProcessing.colorCorrection,
  "brightness",
  { min: -0.5, max: 0.5 },
);
gui.addParam(
  "ColorCorrection contrast",
  postProcessing.colorCorrection,
  "contrast",
  { min: 0.1, max: 3 },
);
gui.addParam(
  "ColorCorrection saturation",
  postProcessing.colorCorrection,
  "saturation",
  { min: 0.1, max: 2 },
);
gui.addParam("ColorCorrection hue", postProcessing.colorCorrection, "hue", {
  min: -180,
  max: 180,
});

gui.addParam("Vignette", State, "vignette", null, () => {
  enablePostProPass("vignette");
});
gui.addParam("Vignette radius", postProcessing.vignette, "radius", {
  min: 0,
  max: 1,
});
gui.addParam("Vignette intensity", postProcessing.vignette, "intensity", {
  min: 0,
  max: 1,
});

gui.addParam("Opacity", postProcessing, "opacity", { min: 0, max: 1 });

gui.addColumn("SSAO");
gui.addParam("Enabled", State, "ssao", null, () => {
  enablePostProPass("ssao");
});
gui.addRadioList(
  "Type",
  postProcessing.ssao,
  "type",
  ["sao", "gtao"].map((value) => ({ name: value, value })),
);
gui.addParam("Samples", postProcessing.ssao, "samples", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addParam("Radius", postProcessing.ssao, "radius", { min: 0, max: 10 });
gui.addParam("Intensity", postProcessing.ssao, "intensity", {
  min: 0,
  max: 10,
});
gui.addParam("Bias", postProcessing.ssao, "bias", { min: 0, max: 0.7 });
gui.addParam("Brightness", postProcessing.ssao, "brightness", {
  min: -0.5,
  max: 0.5,
});
gui.addParam("Contrast", postProcessing.ssao, "contrast", { min: 0.1, max: 3 });

gui.addParam("Noise texture", postProcessing.ssao, "noiseTexture");
gui.addParam("Mix", postProcessing.ssao, "mix", { min: 0, max: 1 });

gui.addLabel("SSAO (SAO)");
gui.addParam("Spiral Turns", postProcessing.ssao, "spiralTurns", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addLabel("SSAO (GTAO)");
gui.addParam("Slices", postProcessing.ssao, "slices", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addParam("Color bounce", postProcessing.ssao, "colorBounce");
gui.addParam("Bounce intensity", postProcessing.ssao, "colorBounceIntensity", {
  min: 0,
  max: 100,
});
gui.addLabel("Blur");
gui.addParam("Radius", postProcessing.ssao, "blurRadius", { min: 0, max: 2 });
gui.addParam("Sharpness", postProcessing.ssao, "blurSharpness", {
  min: 0,
  max: 20,
});

gui.addColumn("Depth of Field");
gui.addParam("Enabled", State, "dof", null, () => {
  enablePostProPass("dof");
});
gui.addParam("Physical", postProcessing.dof, "physical");
gui.addRadioList(
  "Type",
  postProcessing.dof,
  "type",
  ["gustafsson", "upitis"].map((value) => ({ name: value, value })),
);
gui.addParam("Focus Distance", postProcessing.dof, "focusDistance", {
  min: 0,
  max: 10,
});
gui.addParam("Focus Scale", postProcessing.dof, "focusScale", {
  min: 0,
  max: 20,
});
gui.addParam("Samples", postProcessing.dof, "samples", {
  min: 1,
  max: 6,
  step: 1,
});
gui.addParam(
  "Chromatic Aberration",
  postProcessing.dof,
  "chromaticAberration",
  { min: 0, max: 4 },
);
gui.addParam("Luminance Threshold", postProcessing.dof, "luminanceThreshold", {
  min: 0,
  max: 2,
});
gui.addParam("Luminance Gain", postProcessing.dof, "luminanceGain", {
  min: 0,
  max: 2,
});
gui.addRadioList(
  "Shape",
  postProcessing.dof,
  "shape",
  ["disk", "pentagon"].map((value) => ({ name: value, value })),
);
gui.addParam("Focus On Screen Point", postProcessing.dof, "focusOnScreenPoint");
gui.addParam("Screen Point", postProcessing.dof.screenPoint, "0", {
  min: 0,
  max: 1,
});
gui.addParam("Screen Point", postProcessing.dof.screenPoint, "1", {
  min: 0,
  max: 1,
});

gui.addColumn("Camera");
gui.addParam("FoV", camera, "fov", { min: 0, max: (Math.PI / 3) * 2 });
gui.addParam("FocalLength", camera, "focalLength", { min: 10, max: 200 });
gui.addParam("F-Stop", cameraEntity.camera, "fStop", { min: 1.2, max: 32 });
gui.addParam("Exposure", camera, "exposure", { min: 0, max: 5 });
gui.addRadioList(
  "Tone Map",
  camera,
  "toneMap",
  ["none", ...Object.keys(SHADERS.toneMap)].map((value) => ({
    name: value,
    value: value === "none" ? null : value.toLowerCase(),
  })),
);

gui.addColumn("Bloom");
gui.addParam("Enabled", State, "bloom", null, () => {
  enablePostProPass("bloom");
});
gui.addParam("Quality", postProcessing.bloom, "quality", {
  min: 0,
  max: 1,
  step: 1,
});
gui.addRadioList(
  "Color Function",
  postProcessing.bloom,
  "colorFunction",
  ["luma", "luminance", "average"].map((value) => ({ name: value, value })),
);
gui.addParam("Threshold", postProcessing.bloom, "threshold", {
  min: 0,
  max: 2,
});
gui.addRadioList(
  "Source",
  postProcessing.bloom,
  "source",
  ["color+emissive", "color", "emissive"].map((value) => ({
    name: value,
    value,
  })),
);
gui.addParam("Intensity", postProcessing.bloom, "intensity", {
  min: 0,
  max: 10,
});
gui.addParam("Radius", postProcessing.bloom, "radius", { min: 0, max: 10 });
gui.addColumn("Film Grain");
gui.addParam("Enabled", State, "filmGrain", null, () => {
  enablePostProPass("filmGrain");
});
gui.addParam("Quality", postProcessing.filmGrain, "quality", {
  min: 0,
  max: 2,
  step: 1,
});
gui.addParam("Size", postProcessing.filmGrain, "size", { min: 1.5, max: 2.5 });
gui.addParam("Intensity", postProcessing.filmGrain, "intensity", {
  min: 0,
  max: 1,
});
gui.addParam("Color Intensity", postProcessing.filmGrain, "colorIntensity", {
  min: 0,
  max: 1,
});
gui.addParam(
  "Luminance Intensity",
  postProcessing.filmGrain,
  "luminanceIntensity",
  { min: 0, max: 1 },
);
gui.addParam("Speed", postProcessing.filmGrain, "speed", { min: 0, max: 1 });

enablePostProPass("ssao");
enablePostProPass("dof");
enablePostProPass("aa");
enablePostProPass("fog");
enablePostProPass("bloom");
enablePostProPass("lut");
enablePostProPass("colorCorrection");
enablePostProPass("vignette");
enablePostProPass("filmGrain");

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
  const [{ color, normal, depth }] = renderEngine.render(
    world.entities,
    cameraEntity,
  );

  guiNormalControl.texture = normal || dummyTexture2D;
  guiDepthControl.texture = depth;
  guiAOControl.texture =
    postProcessing?._targets?.[cameraEntity.id]?.["ssao.main"] ||
    dummyTexture2D;

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
