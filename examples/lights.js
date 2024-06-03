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

const State = {
  animate: true,
  shadowMapSizeIndex: 2,
  shadowMapSizes: ["512", "1024", "2048", "4096"],
};

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const W = ctx.gl.drawingBufferWidth;
const H = ctx.gl.drawingBufferHeight;
const nW = 2;
const nH = 2;

// Entities
const LAYERS = ["directional", "spot", "point", "area"];
const cameraEntities = gridCells(W, H, nW, nH, 0).map((cell, i) => {
  const cameraEntity = createEntity({
    layer: LAYERS[i],
    transform: components.transform({
      position: [2, 2, 3],
    }),
    camera: components.camera({
      target: [0, 0, 0],
      aspect: W / nW / (H / nH),
      viewport: [
        cell[0],
        H - cell[1] - cell[3], // flip upside down as we are using viewport coordinates
        cell[2],
        cell[3],
      ],
    }),
    orbiter: components.orbiter({ element: ctx.gl.canvas }),
  });
  world.add(cameraEntity);
  return cameraEntity;
});

// Meshes
const dragonEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(dragon),
  material: components.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(dragonEntity);

const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.4, 0],
  }),
  geometry: components.geometry(cube({ sx: 5, sy: 0.1, sz: 5 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    roughness: 0.15,
    metallic: 0.75,
    receiveShadows: true,
    castShadows: false,
  }),
});
world.add(floorEntity);

// Lights
const ambientLightEntity = createEntity({
  ambientLight: components.ambientLight({
    intensity: 0.01,
  }),
});
world.add(ambientLightEntity);

// Directional
const directionalLightEntity = createEntity({
  layer: LAYERS[0],
  transform: components.transform({
    position: [-1, 1, -1],
    rotation: quat.fromPointToPoint(quat.create(), [-1, 1, -1], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    bulbRadius: 10,
    castShadows: true,
    // shadowMapSize: 2048,
  }),
  lightHelper: components.lightHelper(),
});
world.add(directionalLightEntity);

const fixDirectionalLightEntity = createEntity({
  layer: LAYERS[0],
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [1, 1, 1], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight(),
  lightHelper: components.lightHelper(),
});
world.add(fixDirectionalLightEntity);

// Spot
const spotLightEntity = createEntity({
  layer: LAYERS[1],
  transform: components.transform({
    position: [-1, 1, -1],
    rotation: quat.fromPointToPoint(quat.create(), [-1, 1, -1], [0, 0, 0]),
  }),
  spotLight: components.spotLight({
    color: [1, 1, 0, 1],
    intensity: 2,
    range: 5,
    angle: Math.PI / 6,
    innerAngle: Math.PI / 12,
    bulbRadius: 10,
    castShadows: true,
    // shadowMapSize: 2048,
  }),
  lightHelper: components.lightHelper(),
});
world.add(spotLightEntity);

const fixSpotLightEntity = createEntity({
  layer: LAYERS[1],
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [1, 1, 1], [0, 0, 0]),
  }),
  spotLight: components.spotLight(),
  lightHelper: components.lightHelper(),
});
world.add(fixSpotLightEntity);

// Point
const pointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({
    position: [-1, 1, -1],
  }),
  pointLight: components.pointLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    range: 5,
    bulbRadius: 10,
    castShadows: true,
    // shadowMapSize: 512,
  }),
  lightHelper: components.lightHelper(),
});
world.add(pointLightEntity);

const fixPointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({
    position: [1, 1, 1],
  }),
  pointLight: components.pointLight(),
  lightHelper: components.lightHelper(),
});
world.add(fixPointLightEntity);

// Area
const areaLightEntity = createEntity({
  layer: LAYERS[3],
  transform: components.transform({
    scale: [2, 0.5, 1],
    position: [-1, 1, -1],
    rotation: quat.fromPointToPoint(quat.create(), [-1, 1, -1], [0, 0, 0]),
  }),
  areaLight: components.areaLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    disk: true,
    bulbRadius: 10,
    castShadows: true,
  }),
  lightHelper: components.lightHelper(),
});
world.add(areaLightEntity);

const fixAreaLightEntity = createEntity({
  layer: LAYERS[3],
  transform: components.transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [1, 1, 1], [0, 0, 0]),
  }),
  areaLight: components.areaLight(),
  lightHelper: components.lightHelper(),
});
world.add(fixAreaLightEntity);
const rotate = (t) => {
  const phi = Math.PI * 2 * t;
  const position = [Math.cos(phi), 1, Math.sin(phi)];
  const rotation = quat.fromDirection(
    quat.create(),
    position.map((n) => -n),
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
};

// GUI
const gui = createGUI(ctx);
renderEngine.update(world.entities);
renderEngine.render(world.entities, cameraEntities);

const viewportToCanvasPosition = (viewport) => [
  viewport[0] / pixelRatio,
  (H * (1 - viewport[1] / H - viewport[3] / H)) / pixelRatio,
];

const getViewportPosition = (layer, offset = [10, 10]) =>
  vec2.add(
    viewportToCanvasPosition(
      cameraEntities.find((entity) => entity.layer === layer).camera.viewport,
    ),
    offset,
  );

gui.addHeader("Global").setPosition(...getViewportPosition(LAYERS[0]));
gui.addParam("Animate", State, "animate");
gui.addRadioList(
  "Map Size",
  State,
  "shadowMapSizeIndex",
  State.shadowMapSizes.map((name, value) => ({ name, value })),
  () => {
    const shadowMapSize = State.shadowMapSizes[State.shadowMapSizeIndex];
    directionalLightEntity.directionalLight.shadowMapSize =
      fixDirectionalLightEntity.directionalLight.shadowMapSize =
      spotLightEntity.spotLight.shadowMapSize =
      fixSpotLightEntity.spotLight.shadowMapSize =
      pointLightEntity.pointLight.shadowMapSize =
      fixPointLightEntity.pointLight.shadowMapSize =
      areaLightEntity.areaLight.shadowMapSize =
      fixAreaLightEntity.areaLight.shadowMapSize =
        shadowMapSize;
  },
);

const standardRendererSystem = renderEngine.renderers.find(
  (renderer) => renderer.type == "standard-renderer",
);
gui.addParam("Shadow Quality", standardRendererSystem, "shadowQuality", {
  min: 0,
  max: 5,
  step: 1,
});
gui.addHeader("Directional");
gui.addParam(
  "Intensity",
  directionalLightEntity.directionalLight,
  "intensity",
  { min: 0, max: 20 },
);
gui.addParam("Bulb Radius", directionalLightEntity.directionalLight, "bulbRadius", {
  min: 0,
  max: 100,
});
gui.addTexture2D(
  "Shadowmap",
  directionalLightEntity.directionalLight._shadowMap,
  { flipY: true },
);
gui.addParam("Shadows", directionalLightEntity.directionalLight, "castShadows");

gui.addHeader("Spot").setPosition(...getViewportPosition(LAYERS[1]));
gui.addParam("Range", spotLightEntity.spotLight, "range", { min: 0, max: 20 });
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
gui.addParam("Bulb Radius", spotLightEntity.spotLight, "bulbRadius", {
  min: 0,
  max: 100,
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
gui.addParam("Bulb Radius", pointLightEntity.pointLight, "bulbRadius", {
  min: 0,
  max: 100,
});
gui.addTextureCube("Shadowmap", pointLightEntity.pointLight._shadowCubemap);
gui.addParam("Shadows", pointLightEntity.pointLight, "castShadows");

gui.addHeader("Area").setPosition(...getViewportPosition(LAYERS[3]));
gui.addParam("Intensity", areaLightEntity.areaLight, "intensity", {
  min: 0,
  max: 20,
});
gui.addParam("Width", areaLightEntity.transform.scale, "0", {
  min: 0,
  max: 20,
});
gui.addParam("Height", areaLightEntity.transform.scale, "1", {
  min: 0,
  max: 20,
});
gui.addParam("Bulb Radius", areaLightEntity.areaLight, "bulbRadius", {
  min: 0,
  max: 100,
});
gui.addParam("Disk", areaLightEntity.areaLight, "disk");
gui.addParam("Double Sided", areaLightEntity.areaLight, "doubleSided");
gui.addTexture2D("Shadowmap", areaLightEntity.areaLight._shadowMap, {
  flipY: true,
});
gui.addParam("Shadows", areaLightEntity.areaLight, "castShadows");

// Events
let debugOnce = false;

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  if (State.animate) {
    const now = (performance.now() * 0.001) / 3;
    // const now = Math.PI * 1.5;
    // State.animate = false;
    rotate(now);
  }

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntities);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
