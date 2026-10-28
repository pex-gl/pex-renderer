import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "pex-renderer";

import { lens } from "cameras";

import * as gpu from "pex-gpu";
import { loadHdr } from "pex-loaders";
import createGUI from "pex-gui";
import { utils, quat } from "pex-math";

import fitRect from "fit-rect";
import { getURL } from "./utils.js";

// Width × height in mm.
const SENSORS = {
  "Full frame": lens.FULL_FRAME,
  "Super 35": [24.89, 18.66],
  "APS-C": [23.5, 15.6],
  "Micro 4/3": [17.3, 13],
};

const State = {
  resolutionPreset: 1,
  resolutions: [0.5, 1, 2],
  aspectRatioPreset: 0,
  aspectRatios: [
    [16, 9],
    [9, 16],
    [window.innerWidth, window.innerHeight],
  ],
  showSensorFrame: true,
  sensor: "Full frame",
  focalLength: 100,
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const skyboxEntity = createEntity({
  skybox: components.skybox({
    envMap: await loadHdr(
      ctx,
      getURL("assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
    ),
  }),
});
world.add(skyboxEntity);

const reflectionProbeEntity = createEntity({
  reflectionProbe: components.reflectionProbe(),
});
world.add(reflectionProbeEntity);

const sunEntity = createEntity({
  transform: components.transform({
    position: skyboxEntity.skybox.sunPosition,
    rotation: quat.fromDirection(quat.create(), [-1, -1, -1]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 100_000, // lx, a clear midday sun
    castShadows: true,
  }),
});
world.add(sunEntity);

const pointLightEntity = createEntity({
  transform: components.transform({
    position: [-1, 2, -8],
  }),
  pointLight: components.pointLight({
    color: [2, 1, 1, 1],
    // A large film lamp: negligible next to the sun, here for the shadow.
    intensity: 20_000, // lm
    castShadows: true,
  }),
});
world.add(pointLightEntity);

const [scene] = await loaders.gltf(
  getURL("assets/models/dof-reference-poe/dof-reference-poe.gltf"),
  { ctx, includeCameras: true },
);
scene.entities[1].transform.position[0] -= 0.3;
world.entities.push(...scene.entities);

const cameraEntity = scene.entities.filter((entity) => entity.camera)[0];
const postProcessing = components.postProcessing({
  taa: components.postProcessing.taa(),
  dof: components.postProcessing.dof({
    physical: true,
    focusDistance: 7.95,
    focusOnScreenPoint: false,
    screenPoint: [0.5, 0.5],
    // Physical only
    focusScale: 1,
    // Artistic only
    blurriness: 0.03,
    focusRange: 1,
    focusFalloff: 1,
    // Bokeh
    maxCoCRadius: 0.05,
    nearRings: 8,
    farRings: 8,
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
});
// cameraEntity.controls = components.controls.orbit();
cameraEntity.postProcessing = postProcessing;
cameraEntity.camera.far = 100;

cameraEntity.camera.fStop = 2.8;
cameraEntity.camera.shutterSpeed = 1 / 4000;
cameraEntity.camera.focalLength = State.focalLength;

// Sensor gate: sized from `_sensorHeight`, so it shows each sensor fit's crop.
const sensorFrame = document.createElement("div");
sensorFrame.style.cssText =
  "position: fixed; border: 2px solid #00dd00; box-sizing: border-box; pointer-events: none;";
document.body.appendChild(sensorFrame);

const updateSensorFrame = () => {
  const { viewport, sensorSize, _sensorHeight } = cameraEntity.camera;
  sensorFrame.style.display = State.showSensorFrame ? "" : "none";

  const [x, y, width, height] = viewport.map((v) => v / ctx.pixelRatio);
  const frameHeight = (height * sensorSize[1]) / _sensorHeight;
  const frameWidth = (frameHeight * sensorSize[0]) / sensorSize[1];
  sensorFrame.style.left = `${x + (width - frameWidth) / 2}px`;
  sensorFrame.style.top = `${y + (height - frameHeight) / 2}px`;
  sensorFrame.style.width = `${frameWidth}px`;
  sensorFrame.style.height = `${frameHeight}px`;
};

// GUI
const gui = createGUI(ctx);
gui.addColumn("Render Viewport");
gui.addRadioList(
  "Resolution",
  State,
  "resolutionPreset",
  [
    { name: "0.5x", value: 0 },
    { name: "1x", value: 1 },
    { name: "2x", value: 2 },
  ],
  onResize,
);
gui.addRadioList(
  "Camera aspect ratio",
  State,
  "aspectRatioPreset",
  [
    { name: "16:9", value: 0 },
    { name: "9:16", value: 1 },
    { name: "W:H", value: 2 },
  ],
  onResize,
);
gui.addRadioList(
  "Debug Post-Processing",
  renderEngine.systems.find(
    (system) => system.type == "render-pipeline-system",
  ),
  "debugRender",
  [
    "",
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
    "dof.debug",
  ].map((value) => ({
    name: value || "No debug",
    value,
  })),
);
gui.addColumn("Camera");
gui.addHeader("Planes");
gui.addParam("Near", cameraEntity.camera, "near", { min: 0.001, max: 10 });
gui.addParam("Far", cameraEntity.camera, "far", { min: 10, max: 1000 });
gui.addHeader("Lens");
let cameraInfoLabel = gui.addLabel("Info");

// The last one touched drives the lens: a focal length overrides the fov.
gui.addParam(
  "Field Of View (rad)",
  cameraEntity.camera,
  "fov",
  { min: 0, max: (120 / 180) * Math.PI },
  () => {
    cameraEntity.camera.focalLength = undefined;
  },
);
gui.addParam(
  "Focal Length (mm)",
  State,
  "focalLength",
  { min: 1, max: 200 },
  (value) => {
    cameraEntity.camera.focalLength = value;
  },
);
// Optical zoom: scales `_focalLength`, so the depth of field too.
gui.addParam("Zoom", cameraEntity.camera, "zoom", { min: 0.5, max: 4 });

gui.addHeader("Exposure");
gui.addParam("F-Stop", cameraEntity.camera, "fStop", {
  min: 1.2,
  max: 32,
});

gui.addParam("Shutter Speed (s)", cameraEntity.camera, "shutterSpeed", {
  min: 1 / 8000,
  max: 1 / 60,
});
gui.addParam("ISO", cameraEntity.camera, "iso", { min: 50, max: 6400 });
gui.addParam(
  "Exposure compensation (stops)",
  cameraEntity.camera,
  "exposureCompensation",
  { min: -4, max: 4 },
);

gui.addHeader("Sensor");
gui.addParam("Show sensor frame", State, "showSensorFrame");
gui.addRadioList(
  "Format",
  State,
  "sensor",
  Object.keys(SENSORS).map((name) => ({ name, value: name })),
  (name) => {
    // In place: the width and height sliders are bound to this array.
    cameraEntity.camera.sensorSize[0] = SENSORS[name][0];
    cameraEntity.camera.sensorSize[1] = SENSORS[name][1];
  },
);
gui.addParam("Sensor width (mm)", cameraEntity.camera.sensorSize, "0", {
  min: 0,
  max: 100,
});

gui.addParam("Sensor height (mm)", cameraEntity.camera.sensorSize, "1", {
  min: 0,
  max: 100,
});

gui.addRadioList("Sensor fit", cameraEntity.camera, "sensorFit", [
  { name: "Vertical", value: "vertical" },
  { name: "Horizontal", value: "horizontal" },
  { name: "Fill", value: "fill" },
  { name: "Overscan", value: "overscan" },
]);

gui.addColumn("Depth of Field");
gui.addParam("Enabled", postProcessing, "dof");
gui.addParam("Debug CoC", postProcessing.dof, "debug");
gui.addParam("Physical", postProcessing.dof, "physical");
gui.addParam("Focus distance", postProcessing.dof, "focusDistance", {
  min: 0,
  max: 100,
});
gui.addParam("On Screen Point", postProcessing.dof, "focusOnScreenPoint");
gui.addParam("Screen Point X", postProcessing.dof.screenPoint, "0", {
  min: 0,
  max: 1,
});
gui.addParam("Screen Point Y", postProcessing.dof.screenPoint, "1", {
  min: 0,
  max: 1,
});
gui.addLabel("Physical");
gui.addParam("Focus scale", postProcessing.dof, "focusScale", {
  min: 0,
  max: 20,
});
gui.addLabel("Artistic");
gui.addParam("Blurriness", postProcessing.dof, "blurriness", {
  min: 0,
  max: 0.2,
});
gui.addParam("Focus range", postProcessing.dof, "focusRange", {
  min: 0,
  max: 20,
});
gui.addParam("Focus falloff", postProcessing.dof, "focusFalloff", {
  min: 0.1,
  max: 4,
});

gui.addColumn("Bokeh");
gui.addParam("Max CoC Radius", postProcessing.dof, "maxCoCRadius", {
  min: 0,
  max: 0.2,
});
gui.addParam("Near rings", postProcessing.dof, "nearRings", {
  min: 1,
  max: 16,
  step: 1,
});
gui.addParam("Far rings", postProcessing.dof, "farRings", {
  min: 1,
  max: 16,
  step: 1,
});
gui.addParam("Samples", postProcessing.dof, "samples", {
  min: 3,
  max: 12,
  step: 1,
});
gui.addParam("Ring Occlusion", postProcessing.dof, "ringOcclusion");
gui.addParam("Post Filter", postProcessing.dof, "postFilter");
gui.addParam("Transition Blur", postProcessing.dof, "transitionBlur");
gui.addParam("Blades", postProcessing, "blades", {
  min: 0,
  max: 11,
  step: 1,
});
gui.addParam("Blade Rotation", postProcessing, "bladeRotation", {
  min: 0,
  max: Math.PI,
});
gui.addParam("Blade Curvature", postProcessing, "bladeCurvature", {
  min: 0,
  max: 1,
});
gui.addParam(
  "Chromatic Aberration",
  postProcessing.dof,
  "chromaticAberration",
  {
    min: 0,
    max: 0.5,
  },
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

// Events
let debugOnce = false;

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  const pixelRatio = State.resolutions[State.resolutionPreset];
  const windowBounds = [
    0,
    0,
    window.innerWidth * pixelRatio,
    window.innerHeight * pixelRatio,
  ];

  gpu.resize(ctx, width, height, pixelRatio);

  State.aspectRatios[2] = [windowBounds[2], windowBounds[3]];

  const [cameraWidth, cameraHeight] =
    State.aspectRatios[State.aspectRatioPreset];
  cameraEntity.camera.viewport = fitRect(
    [0, 0, cameraWidth, cameraHeight],
    windowBounds,
  );
}

window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntity);
  updateSensorFrame();

  gpu.debug(ctx, debugOnce);
  debugOnce = false;

  const camera = cameraEntity.camera;
  const xfov = 2 * Math.atan(camera.aspect * Math.tan(camera.fov / 2));
  const ev100 = lens.ev100(camera.fStop, camera.shutterSpeed, camera.iso);
  cameraInfoLabel.setTitle(`X FOV : ${utils.toDegrees(xfov).toFixed(0)}°
Y FOV : ${utils.toDegrees(camera.fov).toFixed(0)}°
ASPECT : ${camera.aspect.toFixed(2)}
FOCAL LENGTH : ${camera._focalLength.toFixed(1)}mm
SENSOR HEIGHT : ${camera._sensorHeight.toFixed(1)}mm
EV100 : ${ev100.toFixed(1)}`);
  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
