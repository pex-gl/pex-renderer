import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
  shaders,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { quat, vec3 } from "pex-math";
import { aabb } from "pex-geom";
import random from "pex-random";
import createGUI, { DEFAULT_THEME } from "pex-gui";

import { cube, roundedCube, capsule, sphere } from "primitive-geometry";

import { dragon, getGpuTexture, getURL } from "./utils.js";

import { getRenderPassGraphViz } from "./graph-viz.js";

random.seed(14);

const State = {
  enabled: true,

  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],

  msaa: false,
  taa: true,
  motionBlur: true,
  ssao: true,
  dof: true,
  bloom: true,
  lensFlare: true,
  fog: false,
  vignette: true,
  lut: true,
  colorCorrection: true,
  smaa: false,
  fxaa: true,
  filmGrain: true,
};

const pixelRatio = 1; // devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio, alphaMode: "premultiplied" });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const renderPassGraphViz = getRenderPassGraphViz();
renderPassGraphViz.init(ctx, renderEngine.frameGraph);

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
  aspect: ctx.width / ctx.height,
  clearColor: [0, 0, 0, 0],
});
// Subcomponents go through their own factory rather than a bare object literal:
// the factory is where the defaults live, and a literal carries only the keys it
// spells out — a pass reading one it never set packs an undefined into its
// uniform block.
const postProcessing = components.postProcessing({
  blades: 6,
  bladeRotation: 0,
  bladeCurvature: 0,
  msaa: components.postProcessing.msaa({
    sampleCount: 4,
  }),
  motionBlur: components.postProcessing.motionBlur({
    intensity: 1,
    samples: 35,
    tileSize: 40,
    centerWeightBias: 40,
    directionBlend: 1.5,
    jitterScale: 27,
    tileBlend: 1,
  }),
  taa: components.postProcessing.taa({
    blendFactor: 0.1,
    varianceGamma: 1.25,
    sharpness: 0,
    disocclusionTolerance: 0.02,
    debug: false,
  }),
  ssao: components.postProcessing.ssao({
    type: "sao", // "gtao",
    mix: 1,
    // Shared with GTAO, which scales it by radiusMultiplier.
    radius: 0.5, // m
    brightness: 0,
    contrast: 1,
    // SAO
    saoSamples: 11,
    intensity: 1,
    bias: 0.01, // m
    spiralTurns: 7,
    blurRadius: 8, // px
    blurSharpness: 10,
    slices: 3,
    stepsPerSlice: 3,
    bentNormals: false,
    radiusMultiplier: 1.457,
    falloffRange: 0.615,
    sampleDistributionPower: 2,
    thinOccluderCompensation: 0,
    finalValuePower: 2.2,
    depthMipSamplingOffset: 3.3,
    denoisePasses: 1,
    denoiseBlurBeta: 1.2,
  }),
  dof: components.postProcessing.dof({
    // physical: true,
    physical: false,
    focusDistance: 7,
    focusScale: 1,
    blurriness: 0.03,
    focusRange: 1,
    focusFalloff: 1,
    focusOnScreenPoint: false,
    screenPoint: [0.5, 0.5],
    maxCoCRadius: 0.05,
    rings: 8,
    samples: 6,
    ringOcclusion: true,
    postFilter: true,
    transitionBlur: true,
    chromaticAberration: 0.05,
    luminanceThreshold: 0.7,
    luminanceGain: 1,
    luminanceKnee: 0.5,
    debug: false,
  }),
  bloom: components.postProcessing.bloom({
    quality: 1,
    colorFunction: "luma",
    threshold: 1,
    softKnee: 0.5,
    source: false,
    radius: 1,
    intensity: 0.1,
  }),
  lensFlare: components.postProcessing.lensFlare({
    intensity: 1,
    tint: [1, 1, 1],
    threshold: 3,
    softKnee: 0.5,
    source: false,
    clamp: 50,
    blur: 2,
    ghosts: 4,
    ghostIntensity: 1,
    reversedIntensity: 0.5,
    warpedIntensity: 0,
    ghostStart: 1.25,
    ghostSpacing: 1.5,
    ghostDimmer: 0.8,
    haloIntensity: 0.4,
    haloRadius: 0.4,
    chromaticAberration: 0.02,
    chromaticSamples: 4,
    vignette: 1,
    streakIntensity: 0.5,
    streakLength: 0.5,
    streakThreshold: 0,
    streakRotation: 0,
    streakIterations: 5,
    streakDirections: 0,
  }),
  fog: components.postProcessing.fog({
    color: [0.5, 0.5, 0.5],
    start: 5,
    density: 0.15,

    sunPosition: [1, 1, 1],
    sunDispertion: 0.2,
    sunIntensity: 0.1,
    sunColor: [0.98, 0.98, 0.7],
    inscatteringCoeffs: [0.3, 0.3, 0.3],
  }),
  vignette: components.postProcessing.vignette({
    radius: 0.8,
    intensity: 0.2,
  }),
  lut: components.postProcessing.lut({
    texture: await getGpuTexture(
      ctx,
      getURL(`assets/textures/lut/lookup-autumn.png`),
      false,
      {
        minFilter: "nearest",
        magFilter: "nearest",
        mipmap: false,
        flipY: false,
        aniso: 0,
      },
    ),
  }),
  colorCorrection: components.postProcessing.colorCorrection({
    brightness: 0,
    contrast: 1,
    saturation: 1,
    hue: 0,
  }),
  smaa: components.postProcessing.smaa({
    quality: 2,
    edges: "luma",
  }),
  fxaa: components.postProcessing.fxaa({
    quality: 3,
    subPixelQuality: 0.75,
  }),
  filmGrain: components.postProcessing.filmGrain({
    quality: 2,
    size: 1.6,
    intensity: 0.05,
    colorIntensity: 0.6,
    luminanceIntensity: 1,
    speed: 0.5,
  }),
  exposure: 0, // stops
  toneMap: "aces",
  opacity: 1,
});
const cameraY = s * 1;
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, cameraY, s * 10] }),
  camera,
  orbiter: components.orbiter({
    element: ctx.canvas,
    target: [0, cameraY, 0],
  }),
  postProcessing,
});
world.add(cameraEntity);

// Meshes
const baseColorTexture = await getGpuTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_basecolor.png`),
  true,
);
const normalTexture = await getGpuTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_n.png`),
);
const metallicTexture = await getGpuTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_metallic.png`),
);
const roughnessTexture = await getGpuTexture(
  ctx,
  getURL(`assets/materials/plastic-green.material/plastic-green_roughness.png`),
);
const emissiveColorTexture = await getGpuTexture(
  ctx,
  getURL(`assets/materials/plastic-glow.material/plastic-glow_emissive.png`),
  true,
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
    // Theatrical rather than a real fixture: an accent has to approach the
    // sun's 100 000 lx to read against it at all, and a bulb cannot.
    intensity: 6_300_000, // lm
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
    intensity: 1_570_000, // lm, theatrical for the same reason as the point light
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
    intensity: 100_000, // lx, a clear midday sun
    castShadows: true,
    bias: 0.01,
  }),
});
world.add(sunEntity);

const skyboxEntity = createEntity({
  transform: components.transform(),
  skybox: components.skybox({
    backgroundBlur: 0,
    envMap: await loaders.hdr(
      ctx,
      getURL("assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
    ),
  }),
  reflectionProbe: components.reflectionProbe({}),
});
world.add(skyboxEntity);

renderEngine.systems
  .find(({ type }) => type === "transform-system")
  .sort(world.entities);

// GUI
const gui = createGUI(ctx);
gui.addColumn("Profile");
gui.addFPSMeeter();
gui.addButton("Toggle Render Pass Graph", () => {
  renderPassGraphViz.toggle();
});

gui.addHeader("Camera");
gui.addParam("FoV", camera, "fov", { min: 0, max: (Math.PI / 3) * 2 });
gui.addParam("FocalLength", camera, "focalLength", { min: 10, max: 200 });
gui.addParam("F-Stop", cameraEntity.camera, "fStop", { min: 1.2, max: 32 });
gui.addParam("Shutter Speed (s)", cameraEntity.camera, "shutterSpeed", {
  min: 1 / 8000,
  max: 1 / 60,
});
gui.addParam("ISO", cameraEntity.camera, "iso", { min: 50, max: 6400 });
gui.addHeader("Post-Processing");
gui.addParam("Enabled", State, "enabled", null, () => {
  if (State.enabled) {
    cameraEntity.postProcessing = postProcessing;
  } else {
    delete cameraEntity.postProcessing;
  }
  if (renderPassGraphViz.isRendered()) renderPassGraphViz.draw();
});
const enablePostProPass = (name) => {
  if (State[name]) {
    if (State[`_${name}`]) postProcessing[name] = State[`_${name}`];
  } else {
    State[`_${name}`] = postProcessing[name];
    delete postProcessing[name];
  }
  if (renderPassGraphViz.isRendered()) renderPassGraphViz.draw();
};
// gui.addParam("MSAA", State, "msaa", null, () => {
//   enablePostProPass("msaa");
// });
gui.addParam("Exposure", postProcessing, "exposure", { min: -3, max: 3 });
gui.addRadioList(
  "Tone Map",
  postProcessing,
  "toneMap",
  [{ name: "none", value: null }].concat(
    shaders.postProcessing.TONE_MAP_OPERATORS.map((value) => ({
      name: value,
      value,
    })),
  ),
);
gui.addParam("Blades", postProcessing, "blades", { min: 0, max: 11, step: 1 });
gui.addParam("Blade Rotation", postProcessing, "bladeRotation", {
  min: 0,
  max: Math.PI,
});
gui.addParam("Blade Curvature", postProcessing, "bladeCurvature", {
  min: 0,
  max: 1,
});
gui.addParam("Opacity", postProcessing, "opacity", { min: 0, max: 1 });

gui.addTab("Rendering");
gui.addColumn("Render");
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
  [
    "",
    "ssao.main",
    "ssao.blurHorizontal",
    "ssao.blurVertical",
    "ssao.edges",
    "ssao.denoise[0]",
    "taa.emissive",
    "taa.depthHistory",
    "dof.cocResolve",
    "dof.prefilter",
    "dof.downsample[1]",
    // "dof.downsample[2]",
    // "dof.downsample[3]",
    "dof.tileMaxX",
    "dof.tileMaxY",
    "dof.tileDilate",
    "dof.far",
    "dof.near",
    "dof.farBlur",
    "dof.nearBlur",
    "dof.main",
    "motionBlur.tileMaxX",
    "motionBlur.tileMaxY",
    "motionBlur.neighborMax",
    "motionBlur.main",
    "bloom.threshold",
    "bloom.downsample[0]",
    "bloom.downsample[1]",
    "bloom.downsample[2]",
    "bloom.upsample[2]",
    "bloom.upsample[1]",
    "bloom.upsample[0]",
    "lensFlare.bright",
    // "lensFlare.blurDown[0]",
    // "lensFlare.blurDown[1]",
    // "lensFlare.blurUp[1]",
    // "lensFlare.blurUp[0]",
    "lensFlare.streakSeed",
    "lensFlare.streak[0]",
    "lensFlare.streak[1]",
    "lensFlare.streak[2]",
    "lensFlare.streak[3]",
    "lensFlare.main",
    "combine.main",
    "final.luma",
    "final.main",
    "smaa.edges",
    "smaa.weights",
    "dof.debug",
    "taa.debug",
  ].map((value) => ({
    name: value || "No debug",
    value,
  })),
);
const dummyTexture2D = gpu.createTexture(ctx, {
  name: "dummyTexture2D",
  width: 160,
  height: 1,
  format: "rgba8unorm",
});
gui.addColumn("Outputs");
const guiDepthControl = gui.addTexture2D("Depth", null);
const guiNormalControl = gui.addTexture2D("Normal", null);
const guiVelocityControl = gui.addTexture2D("Velocity", null);
const guiAOControl = gui.addTexture2D("AO", null);

// The occlusion buffer is an internal post-processing target, so it is only a
// handle during the frame and gets recycled once the last pass reading it is
// done. Exporting it keeps it off the recycling list until the frame ends,
// which is what makes it still hold occlusion when the GUI samples it.
let aoHandle;
renderEngine.frameGraph.on("present", (textures) => {
  aoHandle = textures.get("ssao.main");
  if (aoHandle) renderEngine.frameGraph.exportTexture(aoHandle);
});

gui.addParam("Background Blur", skyboxEntity.skybox, "backgroundBlur", {
  min: 0,
  max: 1,
});

// gui.addTab("Material");
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

gui.addTab("SSAO");
gui.addColumn("Common");
gui.addParam("Enabled", State, "ssao", null, () => {
  enablePostProPass("ssao");
});
gui.addRadioList(
  "Type",
  postProcessing.ssao,
  "type",
  ["sao", "gtao"].map((value) => ({ name: value, value })),
);
gui.addParam("Radius", postProcessing.ssao, "radius", { min: 0, max: 10 });
gui.addParam("Brightness", postProcessing.ssao, "brightness", {
  min: -0.5,
  max: 0.5,
});
gui.addParam("Contrast", postProcessing.ssao, "contrast", { min: 0.1, max: 3 });

gui.addColumn("SSAO (SAO)");
gui.addParam("Samples", postProcessing.ssao, "saoSamples", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addParam("Spiral Turns", postProcessing.ssao, "spiralTurns", {
  min: 1,
  max: 17,
  step: 1,
});
gui.addParam("Intensity", postProcessing.ssao, "intensity", {
  min: 0,
  max: 1.5,
});
gui.addParam("Bias", postProcessing.ssao, "bias", { min: 0, max: 0.05 });
gui.addParam("Blur Radius", postProcessing.ssao, "blurRadius", {
  min: 0,
  max: 24,
});
gui.addParam("Blur Sharpness", postProcessing.ssao, "blurSharpness", {
  min: 0,
  max: 20,
});

gui.addColumn("SSAO (GTAO)");
gui.addParam("Slices", postProcessing.ssao, "slices", {
  min: 2,
  max: 20,
  step: 1,
});
gui.addParam("Steps per slice", postProcessing.ssao, "stepsPerSlice", {
  min: 1,
  max: 9,
  step: 1,
});
gui.addParam("Bent normals", postProcessing.ssao, "bentNormals");
gui.addParam("Radius multiplier", postProcessing.ssao, "radiusMultiplier", {
  min: 0.3,
  max: 3,
});
gui.addParam("Mix", postProcessing.ssao, "mix", { min: 0, max: 1 });
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
  { min: 0, max: 30 },
);
gui.addParam("Denoise passes", postProcessing.ssao, "denoisePasses", {
  min: 0,
  max: 5,
  step: 1,
});
gui.addParam("Denoise blur beta", postProcessing.ssao, "denoiseBlurBeta", {
  min: 0,
  max: 5,
});

gui.addTab("TAA");
gui.addColumn("Options");
gui.addParam("Enabled", State, "taa", null, () => {
  enablePostProPass("taa");
});
gui.addParam("TAA blendFactor", postProcessing.taa, "blendFactor", {
  min: 0,
  max: 1,
});
gui.addParam("TAA sharpness", postProcessing.taa, "sharpness", {
  min: 0,
  max: 1,
});
gui.addParam("TAA disocclusion", postProcessing.taa, "disocclusionTolerance", {
  min: 0,
  max: 0.2,
});
gui.addParam("TAA varianceGamma", postProcessing.taa, "varianceGamma", {
  min: 0,
  max: 3,
});
gui.addParam("TAA debug", postProcessing.taa, "debug");

gui.addTab("Motion Blur");
gui.addColumn("Options");
gui.addParam("Enabled", State, "motionBlur", null, () => {
  enablePostProPass("motionBlur");
});
gui.addParam("Intensity", postProcessing.motionBlur, "intensity", {
  min: 0,
  max: 2,
});
gui.addParam("Samples", postProcessing.motionBlur, "samples", {
  min: 3,
  max: 63,
  step: 2,
});
gui.addParam("Tile size", postProcessing.motionBlur, "tileSize", {
  min: 8,
  max: 64,
  step: 8,
});
gui.addParam("Centre weight", postProcessing.motionBlur, "centerWeightBias", {
  min: 1,
  max: 80,
});

gui.addTab("Depth of Field");
gui.addColumn("Options");
gui.addParam("Enabled", State, "dof", null, () => {
  enablePostProPass("dof");
});
gui.addParam("Debug CoC", postProcessing.dof, "debug");
gui.addParam("Ring Occlusion", postProcessing.dof, "ringOcclusion");
gui.addParam("Post Filter", postProcessing.dof, "postFilter");
gui.addParam("Transition Blur", postProcessing.dof, "transitionBlur");
gui.addParam("Physical", postProcessing.dof, "physical");
gui.addParam("Focus Distance", postProcessing.dof, "focusDistance", {
  min: 0,
  max: 10,
});
gui.addParam("Focus On Screen Point", postProcessing.dof, "focusOnScreenPoint");
gui.addParam("Screen Point X", postProcessing.dof.screenPoint, "0", {
  min: 0,
  max: 1,
});
gui.addParam("Screen Point Y", postProcessing.dof.screenPoint, "1", {
  min: 0,
  max: 1,
});
gui.addColumn("Physical");
gui.addParam("Focus Scale", postProcessing.dof, "focusScale", {
  min: 0,
  max: 20,
});
gui.addColumn("Artistic");
gui.addParam("Blurriness", postProcessing.dof, "blurriness", {
  min: 0,
  max: 0.2,
});
gui.addParam("Focus Range", postProcessing.dof, "focusRange", {
  min: 0,
  max: 20,
});
gui.addParam("Focus Falloff", postProcessing.dof, "focusFalloff", {
  min: 0.1,
  max: 4,
});

gui.addColumn("Bokeh");
gui.addParam("Max CoC Radius", postProcessing.dof, "maxCoCRadius", {
  min: 0,
  max: 0.2,
});
gui.addParam("Rings", postProcessing.dof, "rings", {
  min: 1,
  max: 16,
  step: 1,
});
gui.addParam("Samples", postProcessing.dof, "samples", {
  min: 3,
  max: 12,
  step: 1,
});
gui.addParam(
  "Chromatic Aberration",
  postProcessing.dof,
  "chromaticAberration",
  { min: 0, max: 0.5 },
);
gui.addParam("Luminance Threshold", postProcessing.dof, "luminanceThreshold", {
  min: 0,
  max: 2,
});
gui.addParam("Luminance Gain", postProcessing.dof, "luminanceGain", {
  min: 0,
  max: 2,
});
gui.addParam("Luminance Knee", postProcessing.dof, "luminanceKnee", {
  min: 0,
  max: 1,
});

gui.addTab("Bloom");
gui.addColumn("Options");
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
gui.addParam("Soft Knee", postProcessing.bloom, "softKnee", {
  min: 0,
  max: 1,
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

gui.addTab("Lens Flare");
gui.addColumn("Options");
gui.addParam("Enabled", State, "lensFlare", null, () => {
  enablePostProPass("lensFlare");
});
gui.addParam("Intensity", postProcessing.lensFlare, "intensity", {
  min: 0,
  max: 4,
});
gui.addParam("Tint", postProcessing.lensFlare, "tint");
gui.addParam("Threshold", postProcessing.lensFlare, "threshold", {
  min: 0,
  max: 10,
});
gui.addRadioList(
  "Source",
  postProcessing.lensFlare,
  "source",
  [false, "bloom"].map((value) => ({ name: value || "own", value })),
);
gui.addParam("Clamp", postProcessing.lensFlare, "clamp", {
  min: 1,
  max: 500,
});
gui.addParam("Blur", postProcessing.lensFlare, "blur", {
  min: 0,
  max: 4,
});
gui.addParam("Ghosts", postProcessing.lensFlare, "ghosts", {
  min: 0,
  max: 8,
  step: 1,
});
gui.addParam("Ghost Intensity", postProcessing.lensFlare, "ghostIntensity", {
  min: 0,
  max: 2,
});
gui.addParam("Reversed", postProcessing.lensFlare, "reversedIntensity", {
  min: 0,
  max: 2,
});
gui.addParam("Warped", postProcessing.lensFlare, "warpedIntensity", {
  min: 0,
  max: 2,
});
gui.addParam("Ghost Start", postProcessing.lensFlare, "ghostStart", {
  min: 0.5,
  max: 4,
});
gui.addParam("Ghost Spacing", postProcessing.lensFlare, "ghostSpacing", {
  min: 1,
  max: 3,
});
gui.addParam("Ghost Dimmer", postProcessing.lensFlare, "ghostDimmer", {
  min: 0,
  max: 1,
});
gui.addParam("Halo Intensity", postProcessing.lensFlare, "haloIntensity", {
  min: 0,
  max: 2,
});
gui.addParam("Halo Radius", postProcessing.lensFlare, "haloRadius", {
  min: 0,
  max: 1,
});
gui.addParam(
  "Chromatic Aberration",
  postProcessing.lensFlare,
  "chromaticAberration",
  { min: 0, max: 0.2 },
);
gui.addParam("Vignette", postProcessing.lensFlare, "vignette", {
  min: 0,
  max: 1,
});
gui.addParam("Streaks", postProcessing.lensFlare, "streakIntensity", {
  min: 0,
  max: 2,
});
gui.addParam("Streak Length", postProcessing.lensFlare, "streakLength", {
  min: 0,
  max: 1,
});
gui.addParam("Streak Threshold", postProcessing.lensFlare, "streakThreshold", {
  min: 0,
  max: 5,
});
gui.addParam("Streak Rotation", postProcessing.lensFlare, "streakRotation", {
  min: 0,
  max: Math.PI,
});
// 0 takes the axes from the diaphragm below; 1 is the anamorphic streak.
gui.addParam(
  "Streak Directions",
  postProcessing.lensFlare,
  "streakDirections",
  {
    min: 0,
    max: 8,
    step: 1,
  },
);

gui.addTab("Combine");
gui.addColumn("Options");
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

gui.addTab("Final");
gui.addColumn("Options");
gui.addParam("SMAA", State, "smaa", null, () => {
  enablePostProPass("smaa");
});
gui.addParam("Quality", postProcessing.smaa, "quality", {
  min: 0,
  max: 3,
  step: 1,
});
gui.addRadioList(
  "Edges",
  postProcessing.smaa,
  "edges",
  ["depth", "luma", "color"].map((value) => ({ name: value, value })),
);

gui.addParam("FXAA", State, "fxaa", null, () => {
  enablePostProPass("fxaa");
});
gui.addParam("Quality", postProcessing.fxaa, "quality", {
  min: 0,
  max: 4,
  step: 1,
});
gui.addParam("SubPixelQuality", postProcessing.fxaa, "subPixelQuality", {
  min: 0,
  max: 1,
  step: 0.25,
});

gui.addParam("Film Grain", State, "filmGrain", null, () => {
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

enablePostProPass("msaa");
enablePostProPass("taa");
enablePostProPass("motionBlur");
enablePostProPass("ssao");
enablePostProPass("dof");
enablePostProPass("bloom");
enablePostProPass("lensFlare");
enablePostProPass("fog");
enablePostProPass("vignette");
enablePostProPass("lut");
enablePostProPass("colorCorrection");
enablePostProPass("smaa");
enablePostProPass("fxaa");
enablePostProPass("filmGrain");

// Events
let debugOnce = false;

const onResize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  gpu.resize(ctx, width, height, pixelRatio);
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
};
window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  const [{ depth, normal, velocity }] = await renderEngine.render(
    world.entities,
    cameraEntity,
  );

  guiNormalControl.texture = normal || dummyTexture2D;
  guiVelocityControl.texture = velocity || dummyTexture2D;
  guiDepthControl.texture = depth;
  guiAOControl.texture =
    (aoHandle && renderEngine.frameGraph.resolve(aoHandle)) || dummyTexture2D;

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
