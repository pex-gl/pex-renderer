import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { quat, vec2 } from "pex-math";

import { cube } from "primitive-geometry";
import gridCells from "grid-cells";

import { dragon } from "./utils.js";

const {
  camera,
  ambientLight,
  directionalLight,
  pointLight,
  spotLight,
  areaLight,
  geometry,
  material,
  orbiter,
  transform,
} = components;

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });

const renderEngine = createRenderEngine({ ctx });
const world = (window.world = createWorld());

const gui = createGUI(ctx);

const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 2;
const nH = 2;

// Utils
const LAYERS = ["directional", "spot", "point", "area"];
const cameraEntities = gridCells(W, H, nW, nH, 0).map((cell, i) => {
  const cameraEntity = createEntity({
    layer: LAYERS[i],
    transform: transform({
      position: [2, 2, 3],
    }),
    camera: camera({
      target: [0, 0, 0],
      aspect: W / nW / (H / nH),
      viewport: [
        cell[0],
        // flip upside down as we are using viewport coordinates
        H - cell[1] - cell[3],
        cell[2],
        cell[3],
      ],
    }),
    orbiter: orbiter(),
  });
  world.add(cameraEntity);
  return cameraEntity;
});

// Meshes
const dragonEntity = createEntity({
  transform: transform(),
  geometry: geometry(dragon),
  material: material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(dragonEntity);

const floorEntity = createEntity({
  transform: transform({
    position: [0, -0.4, 0],
  }),
  geometry: geometry(cube({ sx: 5, sy: 0.1, sz: 5 })),
  material: material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false,
  }),
});
world.add(floorEntity);

// Lights
const ambientLightEntity = createEntity({
  ambientLight: ambientLight({
    intensity: 0.01,
  }),
});
world.add(ambientLightEntity);

// Directional
const directionalLightEntity = createEntity({
  layer: LAYERS[0],
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    castShadows: true,
    // shadowMapSize: 2048,
  }),
  lightHelper: true,
});
world.add(directionalLightEntity);

const fixDirectionalLightEntity = createEntity({
  layer: LAYERS[0],
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  directionalLight: directionalLight(),
  lightHelper: true,
});
world.add(fixDirectionalLightEntity);

// Spot
const spotLightEntity = createEntity({
  layer: LAYERS[1],
  transform: transform({
    position: [1, 0.5, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  spotLight: spotLight({
    color: [1, 1, 0, 1],
    intensity: 2,
    range: 5,
    angle: Math.PI / 6,
    innerAngle: Math.PI / 12,
    castShadows: true,
    // shadowMapSize: 2048,
  }),
  lightHelper: true,
});
world.add(spotLightEntity);

const fixSpotLightEntity = createEntity({
  layer: LAYERS[1],
  transform: transform({
    position: [1, 0.5, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  spotLight: spotLight(),
  lightHelper: true,
});
world.add(fixSpotLightEntity);

// Point
const pointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: transform({
    position: [1, 1, 1],
  }),
  pointLight: pointLight({
    color: [1, 1, 0, 1],
    intensity: 2,
    range: 5,
    castShadows: true,
    // shadowMapSize: 512,
  }),
  lightHelper: true,
});
world.add(pointLightEntity);

const fixPointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: transform({
    position: [1, 1, 1],
  }),
  pointLight: pointLight(),
  lightHelper: true,
});
world.add(fixPointLightEntity);

// Area
const areaLightEntity = createEntity({
  layer: LAYERS[3],
  transform: transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  areaLight: areaLight({
    color: [1, 1, 0, 1],
    intensity: 4,
    castShadows: true,
  }),
  lightHelper: true,
});
world.add(areaLightEntity);

const fixAreaLightEntity = createEntity({
  layer: LAYERS[3],
  transform: transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  areaLight: areaLight(),
  lightHelper: true,
});
world.add(fixAreaLightEntity);

// GUI
renderEngine.update(world.entities);
renderEngine.render(world.entities, cameraEntities);

const viewportToCanvasPosition = (viewport) => [
  viewport[0] / pixelRatio,
  (H * (1 - viewport[1] / H - viewport[3] / H)) / pixelRatio,
];

const getViewportPosition = (layer, offset = [10, 10]) =>
  vec2.add(
    viewportToCanvasPosition(
      cameraEntities.find((e) => e.layer === layer).camera.viewport
    ),
    offset
  );

gui.addHeader("Directional").setPosition(...getViewportPosition(LAYERS[0]));
gui.addParam(
  "Intensity",
  directionalLightEntity.directionalLight,
  "intensity",
  {
    min: 0,
    max: 20,
  }
);
gui.addTexture2D(
  "Shadowmap",
  directionalLightEntity.directionalLight._shadowMap,
  { flipY: true }
);
gui.addParam("Shadows", directionalLightEntity.directionalLight, "castShadows");

gui.addHeader("Spot").setPosition(...getViewportPosition(LAYERS[1]));
gui.addParam("Range", spotLightEntity.spotLight, "range", {
  min: 0,
  max: 20,
});
gui.addParam("Intensity", spotLightEntity.spotLight, "intensity", {
  min: 0,
  max: 20,
});
gui.addParam("Angle", spotLightEntity.spotLight, "angle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
gui.addParam("Inner angle", spotLightEntity.spotLight, "innerAngle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
gui.addTexture2D("Shadowmap", spotLightEntity.spotLight._shadowMap, {
  flipY: true,
});
gui.addParam("Shadows", spotLightEntity.spotLight, "castShadows");

gui.addHeader("Point").setPosition(...getViewportPosition(LAYERS[2]));
gui.addParam("Range", pointLightEntity.pointLight, "range", {
  min: 0,
  max: 20,
});
gui.addParam("Intensity", pointLightEntity.pointLight, "intensity", {
  min: 0,
  max: 20,
});
gui.addTextureCube("Shadowmap", pointLightEntity.pointLight._shadowCubemap);
gui.addParam("Shadows", pointLightEntity.pointLight, "castShadows");

gui.addHeader("Area").setPosition(...getViewportPosition(LAYERS[3]));
gui.addParam("Intensity", areaLightEntity.areaLight, "intensity", {
  min: 0,
  max: 20,
});
gui.addStats();

// Events
let debugOnce = false;

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

let delta = 0;

ctx.frame(() => {
  delta += 0.005;

  const position = [Math.cos(delta), 1, Math.sin(delta)];
  const rotation = quat.targetTo(
    quat.create(),
    position.map((n) => -n),
    [0, 0, 0]
  );

  directionalLightEntity.transform.position = position;
  directionalLightEntity.transform.rotation = rotation;

  spotLightEntity.transform.position = position;
  spotLightEntity.transform.rotation = rotation;

  pointLightEntity.transform.position = position;

  areaLightEntity.transform.position = position;
  areaLightEntity.transform.rotation = rotation;

  directionalLightEntity.transform.dirty =
    spotLightEntity.transform.dirty =
    pointLightEntity.transform.dirty =
    areaLightEntity.transform.dirty =
      true;

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntities);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
