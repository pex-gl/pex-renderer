import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import createGUI, { DEFAULT_THEME } from "pex-gui";
import { quat, vec2 } from "pex-math";

import { cube } from "primitive-geometry";
import gridCells from "grid-cells";

import { dragon } from "./utils.js";

const LAYERS = ["directional", "spot", "point", "area"];

const State = {
  animate: true,
  shadows: true,
  enabled: Object.fromEntries(LAYERS.map((layer) => [layer, true])),
  floorReceiveShadows: true,
  floorCastShadows: false,
  meshReceiveShadows: true,
  meshCastShadows: true,
  rotation: 0,
  // shadowMapSizeIndex: 2,
  // shadowMapSizes: ["512", "1024", "2048", "4096"],
};

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();
window.world = world;

const W = ctx.width;
const H = ctx.height;
const nW = 2;
const nH = 2;

// Entities
const cameraEntities = gridCells(W, H, nW, nH, 0).map((cell, i) => {
  const cameraEntity = createEntity({
    layer: LAYERS[i],
    transform: components.transform({ position: [2, 2, 3] }),
    camera: components.camera({
      // Metered for the studio lamps below rather than for daylight: f/2.8 at
      // 1/30s is EV 7.9, where 500 lx on white reads just over half.
      fStop: 2.8,
      shutterSpeed: 1 / 30,
      target: [0, 0, 0],
      aspect: W / nW / (H / nH),
      viewport: [cell[0], cell[1], cell[2], cell[3]],
    }),
    postProcessing: components.postProcessing(),
    orbiter: components.orbiter({ element: ctx.canvas }),
  });
  world.add(cameraEntity);
  return cameraEntity;
});

// Meshes
const meshEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(dragon),
  material: components.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(meshEntity);

const floorEntity = createEntity({
  transform: components.transform({ position: [0, -0.4, 0] }),
  geometry: components.geometry(cube({ sx: 5, sy: 0.1, sz: 5 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    roughness: 0.15,
    metallic: 0.25,
    receiveShadows: true,
  }),
});
world.add(floorEntity);

// Lights
const ambientLightEntity = createEntity({
  ambientLight: components.ambientLight({ intensity: 1.6 }), // cd/m²
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
    intensity: 500, // lx
    bulbRadius: 0.3,
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
  directionalLight: components.directionalLight({ intensity: 500 }), // lx
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
    intensity: 4700, // lm, a stage fresnel
    range: 5,
    outerConeAngle: Math.PI / 6,
    innerConeAngle: Math.PI / 12,
    focusedSpot: false,
    bulbRadius: 0.03,
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
  spotLight: components.spotLight({ intensity: 4700 }), // lm
  lightHelper: components.lightHelper(),
});
world.add(fixSpotLightEntity);

// Point
const pointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({ position: [-1, 1, -1] }),
  pointLight: components.pointLight({
    color: [1, 1, 0, 1],
    intensity: 19_000, // lm, a 1 kW studio lamp
    range: 5,
    bulbRadius: 0.1,
  }),
  lightHelper: components.lightHelper(),
});
world.add(pointLightEntity);

const fixPointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({ position: [1, 1, 1] }),
  pointLight: components.pointLight({ intensity: 19_000 }), // lm
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
    intensity: 3700, // lm, a 1 m² softbox
    disk: true,
    bulbRadius: 0.1,
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
  areaLight: components.areaLight({ intensity: 4700 }), // lm
  lightHelper: components.lightHelper(),
});
world.add(fixAreaLightEntity);

const LIGHT_COMPONENTS = [
  "directionalLight",
  "spotLight",
  "pointLight",
  "areaLight",
];
const lights = world.entities.flatMap((entity) =>
  LIGHT_COMPONENTS.map((type) => entity[type]).filter(Boolean),
);

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
await renderEngine.render(world.entities, cameraEntities);

// A light's shadow map lives on `_shadows`, keyed by the camera layer it
// was fitted for — a light seen by several layers has one map per layer — and
// the entry is undefined on a frame where the light didn't cast. The GUI holds
// the control and re-reads the shadow each frame rather than capturing one.
const DUMMY_DEPTH = {
  width: 4,
  height: 4,
  format: "depth32float",
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
};
const dummyShadowMap = gpu.createTexture(ctx, {
  name: "dummyShadowMap",
  ...DUMMY_DEPTH,
});
const dummyShadowCubemap = gpu.createTexture(ctx, {
  name: "dummyShadowCubemap",
  ...DUMMY_DEPTH,
  depth: 6,
  viewDimension: "cube",
});

const shadowMapControls = [];
// Only a spot or area light needs its planes: those project perspectively, so
// the stored depth is nonlinear and the GUI linearises it with near/far. A
// directional light is orthographic and a point light writes radial distance
// over `far` by hand, so both are linear across [0, 1] already.
const addShadowMap = (
  lightEntity,
  light,
  { cubemap = false, perspective = false } = {},
) => {
  const dummy = cubemap ? dummyShadowCubemap : dummyShadowMap;
  shadowMapControls.push({
    control: cubemap
      ? gui.addTextureCube("Shadowmap", dummy)
      : gui.addTexture2D("Shadowmap", dummy, { flipY: true }),
    entity: lightEntity,
    light,
    layer: lightEntity.layer ?? "",
    dummy,
    perspective,
  });
};

// Removing an entity from the world is all it takes to drop a light: the
// systems only ever see what `renderEngine.update`/`render` are handed.
const addEnabledParam = (lightEntity) => {
  gui.addParam("Enabled", State.enabled, lightEntity.layer, {}, (enabled) => {
    if (enabled) world.add(lightEntity);
    else world.entities.splice(world.entities.indexOf(lightEntity), 1);
  });
};

const viewportToCanvasPosition = (viewport) => [
  viewport[0] / pixelRatio,
  viewport[1] / pixelRatio,
];

const getViewportPosition = (layer, offset = [10, 10]) =>
  vec2.add(
    viewportToCanvasPosition(
      cameraEntities.find((entity) => entity.layer === layer).camera.viewport,
    ),
    offset,
  );

gui.addHeader("Directional");
addEnabledParam(directionalLightEntity);

gui.addParam(
  "Intensity",
  directionalLightEntity.directionalLight,
  "intensity",
  { min: 0, max: 2000 },
);
gui.addParam(
  "Bulb Radius",
  directionalLightEntity.directionalLight,
  "bulbRadius",
  { min: 0, max: 100 },
);
addShadowMap(directionalLightEntity, directionalLightEntity.directionalLight);
gui.addParam(
  "Cast Shadows",
  directionalLightEntity.directionalLight,
  "castShadows",
);

gui
  .addHeader("Global")
  .setPosition(
    ...getViewportPosition(LAYERS[1], [-DEFAULT_THEME.columnWidth - 10, 10]),
  );
gui.addParam("Animate", State, "animate");
gui.addParam("Rotation", State, "rotation", { min: 0, max: 1 }, () => {
  State.animate = false;
  rotate(State.rotation);
});
gui.addParam("Shadows", State, "shadows", {}, () => {
  for (const light of lights) light.castShadows = State.shadows;
});

// gui.addRadioList(
//   "Map Size",
//   State,
//   "shadowMapSizeIndex",
//   State.shadowMapSizes.map((name, value) => ({ name, value })),
//   () => {
//     const shadowMapSize = State.shadowMapSizes[State.shadowMapSizeIndex];
//     directionalLightEntity.directionalLight.shadowMapSize =
//       fixDirectionalLightEntity.directionalLight.shadowMapSize =
//       spotLightEntity.spotLight.shadowMapSize =
//       fixSpotLightEntity.spotLight.shadowMapSize =
//       pointLightEntity.pointLight.shadowMapSize =
//       fixPointLightEntity.pointLight.shadowMapSize =
//       areaLightEntity.areaLight.shadowMapSize =
//       fixAreaLightEntity.areaLight.shadowMapSize =
//         shadowMapSize;
//   },
// );

const standardRendererSystem = renderEngine.renderers.find(
  (renderer) => renderer.type == "standard-renderer",
);
gui.addParam("Shadow Quality", standardRendererSystem, "shadowQuality", {
  min: 0,
  max: 5,
  step: 1,
});

gui.addHeader("Floor");
gui.addParam("Cast Shadows", State, "floorCastShadows", {}, () => {
  floorEntity.material.castShadows = State.floorCastShadows;
});
gui.addParam("Receive Shadows", State, "floorReceiveShadows", {}, () => {
  floorEntity.material.receiveShadows = State.floorReceiveShadows;
});
gui.addHeader("Mesh");
gui.addFPSMeeter();
gui.addParam("Cast Shadows", State, "meshCastShadows", {}, () => {
  meshEntity.material.castShadows = State.meshCastShadows;
});
gui.addParam("Receive Shadows", State, "meshReceiveShadows", {}, () => {
  meshEntity.material.receiveShadows = State.meshReceiveShadows;
});

gui.addHeader("Spot").setPosition(...getViewportPosition(LAYERS[1]));
addEnabledParam(spotLightEntity);
gui.addParam("Range", spotLightEntity.spotLight, "range", { min: 0, max: 20 });
gui.addParam("Intensity", spotLightEntity.spotLight, "intensity", {
  min: 0,
  max: 20000,
});
gui.addParam("Outer cone angle", spotLightEntity.spotLight, "outerConeAngle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
gui.addParam("Inner cone angle", spotLightEntity.spotLight, "innerConeAngle", {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON,
});
gui.addParam("Focused Spot", spotLightEntity.spotLight, "focusedSpot");
gui.addParam("Bulb Radius", spotLightEntity.spotLight, "bulbRadius", {
  min: 0,
  max: 100,
});
addShadowMap(spotLightEntity, spotLightEntity.spotLight, {
  perspective: true,
});
gui.addParam("Cast Shadows", spotLightEntity.spotLight, "castShadows");

gui.addHeader("Point").setPosition(...getViewportPosition(LAYERS[2]));
addEnabledParam(pointLightEntity);
gui.addParam("Range", pointLightEntity.pointLight, "range", {
  min: 0,
  max: 20,
});
gui.addParam("Intensity", pointLightEntity.pointLight, "intensity", {
  min: 0,
  max: 80000,
});
gui.addParam("Bulb Radius", pointLightEntity.pointLight, "bulbRadius", {
  min: 0,
  max: 100,
});
addShadowMap(pointLightEntity, pointLightEntity.pointLight, {
  cubemap: true,
});
gui.addParam("Cast Shadows", pointLightEntity.pointLight, "castShadows");

gui.addHeader("Area").setPosition(...getViewportPosition(LAYERS[3]));
addEnabledParam(areaLightEntity);
gui.addParam("Intensity", areaLightEntity.areaLight, "intensity", {
  min: 0,
  max: 20000,
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
addShadowMap(areaLightEntity, areaLightEntity.areaLight, {
  perspective: true,
});
gui.addParam("Cast Shadows", areaLightEntity.areaLight, "castShadows");

gpu.frame(ctx, async () => {
  if (State.animate) rotate(performance.now() * 0.001 * 0.1);

  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntities);

  // The pipeline refits near/far to the scene bounds every frame, so both the
  // texture and the planes have to be re-read rather than captured.
  for (const {
    control,
    entity,
    light,
    layer,
    dummy,
    perspective,
  } of shadowMapControls) {
    // A light the world no longer holds keeps its last `_shadows` entry: only
    // the lights handed to the pipeline get cleared, and the texture it names
    // has since been recycled by the pool.
    const shadow = world.entities.includes(entity)
      ? light._shadows?.get(layer)
      : undefined;
    control.texture = shadow?.texture || dummy;
    control.options.layer = shadow?.texture ? shadow.layer : 0;
    if (perspective) {
      control.options.near = shadow?.near;
      control.options.far = shadow?.far;
    }
  }

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
