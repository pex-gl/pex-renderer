import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { utils, vec3, quat } from "pex-math";
const { toDegrees } = utils;

import fitRect from "fit-rect";
import { getURL } from "./utils.js";

const ctx = createContext();
const renderer = createRenderer({
  ctx,
  shadowQuality: 3,
});
const gui = createGUI(ctx);
const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [0.2, 1, 0.2],
  }),
]);
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()]);
renderer.add(reflectionProbeEntity);

const sunEntity = renderer.entity([
  renderer.transform({
    position: skyboxEntity.getComponent("Skybox").sunPosition,
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-1, -1, -1])
    ),
  }),
  renderer.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 5,
    castShadows: true,
  }),
]);
renderer.add(sunEntity);

const pointLightEntity = renderer.entity([
  renderer.transform({
    position: [-1, 2, -8],
  }),
  renderer.pointLight({
    color: [2, 1, 1, 1],
    intensity: 2,
    castShadows: true,
  }),
]);
renderer.add(pointLightEntity);

const rendererState = {
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

gui.addHeader("Render Viewport");
gui.addRadioList(
  "Resolution",
  rendererState,
  "resolutionPreset",
  [
    { name: "0.5x", value: 0 },
    { name: "1x", value: 1 },
    { name: "2x", value: 2 },
  ],
  resize
);
gui.addRadioList(
  "Camera aspect ratio",
  rendererState,
  "aspectRatioPreset",
  [
    { name: "16:9", value: 0 },
    { name: "9:16", value: 1 },
    { name: "W:H", value: 2 },
  ],
  resize
);

let sensorRectOverlay = null;
let camera = null;
let postProcessing = null;

gui.addHeader("Camera Lens");
let cameraInfoLabel = gui.addLabel("Info");

function resize() {
  if (!camera) return;

  const pixelRatio = rendererState.resolutions[rendererState.resolutionPreset];
  const windowBounds = [
    0,
    0,
    window.innerWidth * pixelRatio,
    window.innerHeight * pixelRatio,
  ];

  ctx.set({
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio,
  });
  rendererState.aspectRatios[2] = [windowBounds[2], windowBounds[3]];

  const [cameraWidth, cameraHeight] =
    rendererState.aspectRatios[rendererState.aspectRatioPreset];
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
      //horizontal || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, "cover");
    }
  } else {
    if (camera.sensorFit === "horizontal" || camera.sensorFit === "overscan") {
      sensorFitBounds = fitRect(sensorBounds, cameraViewport);
    } else {
      //vertical || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, "cover");
    }
  }

  sensorRectOverlay.set({
    x: sensorFitBounds[0],
    y: sensorFitBounds[1],
    width: sensorFitBounds[2],
    height: sensorFitBounds[3],
  });

  camera.set({ viewport: cameraViewport });

  gui.pixelRatio = pixelRatio;
}

window.addEventListener("resize", resize);

async function initScene() {
  const scene = await renderer.loadScene(
    getURL("assets/models/dof-reference-poe/dof-reference-poe.gltf"),
    { includeCameras: true }
  );
  renderer.add(scene.root);

  const cameraEnt = scene.entities.filter((e) => e.getComponent("Camera"))[0];
  camera = cameraEnt.getComponent("Camera");
  camera.set({ exposure: 0.6 });

  postProcessing = renderer.postProcessing({
    dof: true,
    dofFocusDistance: 8,
  });
  cameraEnt.addComponent(postProcessing);

  gui.addParam(
    "fieldOfView (rad)",
    camera,
    "fov",
    { min: 0, max: (120 / 180) * Math.PI },
    (fov) => {
      camera.set({ fov });
    }
  );
  gui.addParam(
    "focalLength (mm)",
    camera,
    "focalLength",
    { min: 0, max: 200 },
    (focalLength) => {
      camera.set({ focalLength });
    }
  );
  gui.addParam("F-Stop", camera, "fStop", {
    min: 1.2,
    max: 32,
  });

  gui.addHeader("Camera Sensor");
  gui.addParam("Show sensor frame", rendererState, "showSensorFrame");
  gui.addParam(
    "Sensor width (mm)",
    camera.sensorSize,
    "0",
    { min: 0, max: 100 },
    () => {
      camera.set({ sensorSize: camera.sensorSize });
    }
  );

  gui.addParam(
    "Sensor height (mm)",
    camera.sensorSize,
    "1",
    {
      min: 0,
      max: 100,
    },
    () => {
      camera.set({ sensorSize: camera.sensorSize });
    }
  );

  gui.addRadioList(
    "Sensor fit",
    camera,
    "sensorFit",
    [
      { name: "Vertical", value: "vertical" },
      { name: "Horizontal", value: "horizontal" },
      { name: "Fill", value: "fill" },
      { name: "Overscan", value: "overscan" },
    ],
    () => {
      // set value again to trigger fieldOfView change
      camera.set({ sensorFit: camera.sensorFit });
      resize();
    }
  );

  postProcessing.set({ dofDebug: true });
  gui.addHeader("Depth of Field");
  gui.addParam("Enabled", postProcessing, "dof");
  gui.addParam("Debug", postProcessing, "dofDebug");
  gui.addParam("Focus distance", postProcessing, "dofFocusDistance", {
    min: 0,
    max: 100,
  });

  let rectCanvas = document.createElement("canvas");
  rectCanvas.width = camera.sensorSize[0] * 10;
  rectCanvas.height = camera.sensorSize[1] * 10;
  let rectCtx = rectCanvas.getContext("2d");
  rectCtx.strokeStyle = "#00DD00";
  rectCtx.lineWidth = 3;
  rectCtx.strokeRect(0, 0, rectCanvas.width, rectCanvas.height);

  const rectTexture = ctx.texture2D({
    data: rectCanvas,
    width: 360,
    height: 240,
  });

  sensorRectOverlay = renderer.overlay({
    texture: rectTexture,
    x: 2,
    y: 2,
    width: 500,
    height: 100,
  });
  const sensorRectOverlayEnt = renderer.entity([sensorRectOverlay]);

  renderer.add(sensorRectOverlayEnt);

  resize();
}

initScene();

ctx.frame(() => {
  renderer.draw();

  if (camera) {
    let aspectRatio = camera.aspect;
    let yfov = camera.fov;
    let xfov = 2 * Math.atan(aspectRatio * Math.tan(camera.fov / 2));
    let str = [
      `X FOV : ${toDegrees(xfov).toFixed(0)}°`,
      `Y FOV : ${toDegrees(yfov).toFixed(0)}°`,
      `ASPECT : ${aspectRatio.toFixed(2)}`,
    ];
    cameraInfoLabel.setTitle(str.join("\n"));
    window.dispatchEvent(new CustomEvent("pex-screenshot"));
  }

  if (sensorRectOverlay) {
    sensorRectOverlay.enabled = rendererState.showSensorFrame;
  }

  gui.draw();
});
