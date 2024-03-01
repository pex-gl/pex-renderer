import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
  loaders,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { utils, vec3, quat } from "pex-math";
import { pipeline as SHADERS } from "pex-shaders";

import fitRect from "fit-rect";
import { getEnvMap, getURL } from "./utils.js";

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
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const skyboxEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [0.2, 1, 0.2],
    envMap: await getEnvMap(ctx, "assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr"),
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
    intensity: 5,
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
    intensity: 2,
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
  dof: components.postProcessing.dof({
    focusDistance: 7.95,
  }),
});
cameraEntity.postProcessing = postProcessing;
cameraEntity.camera.far = 100;

const rectCanvas = document.createElement("canvas");
document.body.appendChild(rectCanvas);
rectCanvas.width = cameraEntity.camera.sensorSize[0] * 10;
rectCanvas.height = cameraEntity.camera.sensorSize[1] * 10;
const rectCtx = rectCanvas.getContext("2d");
rectCtx.strokeStyle = "#00DD00";
rectCtx.lineWidth = 3;
rectCtx.strokeRect(0, 0, rectCanvas.width, rectCanvas.height);

const overlayEntity = createEntity({
  overlay: {
    bounds: [0, 0, 1, 1],
    texture: ctx.texture2D({ data: rectCanvas, width: 1, height: 1 }),
  },
});
world.add(overlayEntity);

const createOverlayRenderer = ({ ctx }) => {
  const overlayRendererSystem = {
    type: "overlay-renderer",
    cache: {},
    drawOverlayCmd: {
      attributes: {
        aPosition: ctx.vertexBuffer([-1, -1, 1, -1, 1, 1, -1, 1]),
        aTexCoord0: ctx.vertexBuffer([0, 0, 1, 0, 1, 1, 0, 1]),
      },
      indices: ctx.indexBuffer([0, 1, 2, 0, 2, 3]),
      pipeline: ctx.pipeline({
        program: ctx.program({
          vert: SHADERS.overlay.vert,
          frag: SHADERS.overlay.frag,
        }),
        depthWrite: false,
        blend: true,
        blendSrcRGBFactor: ctx.BlendFactor.One,
        blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
        blendSrcAlphaFactor: ctx.BlendFactor.One,
        blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      }),
    },
    render(entity) {
      ctx.submit(overlayRendererSystem.drawOverlayCmd, {
        uniforms: {
          uBounds: entity.overlay.bounds,
          uTexture: entity.overlay.texture,
        },
      });
    },
    update: () => {},
  };
  return overlayRendererSystem;
};

const overlayRenderer = createOverlayRenderer({ ctx });

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
gui.addColumn("Camera");
gui.addHeader("Planes");
gui.addParam("Near", cameraEntity.camera, "near", { min: 0.001, max: 10 });
gui.addParam("Far", cameraEntity.camera, "far", { min: 10, max: 1000 });
gui.addHeader("Lens");
let cameraInfoLabel = gui.addLabel("Info");

gui.addParam("Field Of View (rad)", cameraEntity.camera, "fov", {
  min: 0,
  max: (120 / 180) * Math.PI,
});
gui.addParam("Focal Length (mm)", cameraEntity.camera, "focalLength", {
  min: 0,
  max: 200,
});
gui.addParam("F-Stop", cameraEntity.camera, "fStop", {
  min: 1.2,
  max: 32,
});

gui.addHeader("Sensor");
gui.addParam("Show sensor frame", State, "showSensorFrame");
gui.addParam("Sensor width (mm)", cameraEntity.camera.sensorSize, "0", {
  min: 0,
  max: 100,
});

gui.addParam("Sensor height (mm)", cameraEntity.camera.sensorSize, "1", {
  min: 0,
  max: 100,
});

gui.addRadioList(
  "Sensor fit",
  cameraEntity.camera,
  "sensorFit",
  [
    { name: "Vertical", value: "vertical" },
    { name: "Horizontal", value: "horizontal" },
    { name: "Fill", value: "fill" },
    { name: "Overscan", value: "overscan" },
  ],
  () => {
    // set value again to trigger fieldOfView change
    onResize();
  },
);

gui.addColumn("Depth of Field");
gui.addParam("Enabled", postProcessing, "dof");
gui.addParam("Physical", postProcessing.dof, "physical");
gui.addRadioList(
  "Type",
  postProcessing.dof,
  "type",
  ["gustafsson", "upitis"].map((value) => ({ name: value, value })),
);
gui.addParam("Focus distance", postProcessing.dof, "focusDistance", {
  min: 0,
  max: 100,
});
gui.addParam("Focus scale", postProcessing.dof, "focusScale", {
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
  {
    min: 0,
    max: 4,
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
gui.addRadioList(
  "Shape",
  postProcessing.dof,
  "shape",
  ["disk", "pentagon"].map((value) => ({ name: value, value })),
);
gui.addParam("On Screen Point", postProcessing.dof, "focusOnScreenPoint");
gui.addParam("Screen Point", postProcessing.dof, "screenPoint", {
  min: 0,
  max: 1,
});
gui.addParam("Debug", postProcessing.dof, "debug");

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

  ctx.set({ pixelRatio, width, height });

  State.aspectRatios[2] = [windowBounds[2], windowBounds[3]];

  const camera = cameraEntity.camera;

  const [cameraWidth, cameraHeight] =
    State.aspectRatios[State.aspectRatioPreset];
  const cameraBounds = [0, 0, cameraWidth, cameraHeight];
  const cameraViewport = fitRect(cameraBounds, windowBounds);
  const sensorBounds = [0, 0, camera.sensorSize[0], camera.sensorSize[1]];
  let sensorFitBounds = [0, 0, 0.1, 0.1];

  const sensorAspectRatio = camera.sensorSize[0] / camera.sensorSize[1];
  const cameraAspectRatio = cameraWidth / cameraHeight;
  if (cameraAspectRatio > sensorAspectRatio) {
    if (camera.sensorFit === "vertical" || camera.sensorFit === "overscan") {
      sensorFitBounds = fitRect(sensorBounds, cameraViewport);
    } else {
      // horizontal || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, "cover");
    }
  } else {
    if (camera.sensorFit === "horizontal" || camera.sensorFit === "overscan") {
      sensorFitBounds = fitRect(sensorBounds, cameraViewport);
    } else {
      // vertical || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, "cover");
    }
  }

  let bounds = [...sensorFitBounds];
  if (sensorFitBounds.some((d) => d > 1)) {
    bounds[0] /= width;
    bounds[1] /= height;
    bounds[2] /= width;
    bounds[3] /= height;
  }
  // overlay coordinates are from top left corner so we need to flip y
  bounds[1] = 1.0 - bounds[1] - bounds[3];

  // State.sensorFitBounds = bounds;

  overlayEntity.overlay.bounds = bounds;

  camera.viewport = cameraViewport;
}

window.addEventListener("resize", onResize);
onResize();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);
  overlayRenderer.render(overlayEntity);

  ctx.debug(debugOnce);
  debugOnce = false;

  const aspectRatio = cameraEntity.camera.aspect;
  const yfov = cameraEntity.camera.fov;
  const xfov =
    2 * Math.atan(aspectRatio * Math.tan(cameraEntity.camera.fov / 2));
  cameraInfoLabel.setTitle(`X FOV : ${utils.toDegrees(xfov).toFixed(0)}°
Y FOV : ${utils.toDegrees(yfov).toFixed(0)}°
ASPECT : ${aspectRatio.toFixed(2)}`);
  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
