import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { quat } from "pex-math";

import { cube } from "primitive-geometry";
import gridCells from "grid-cells";

import { dragon } from "./utils.js";

const State = { animate: true };

const pixelRatio = devicePixelRatio;
const ctx = await gpu.createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const W = ctx.width;
const H = ctx.height;
const nW = 2;
const nH = 2;

// Entities
const LAYERS = ["directional", "spot", "point", "area"];
const cameraEntities = gridCells(W, H, nW, nH, 0).map((cell, i) => {
  const cameraEntity = createEntity({
    layer: LAYERS[i],
    transform: components.transform({ position: [2, 2, 3] }),
    camera: components.camera({
      target: [0, 0, 0],
      aspect: W / nW / (H / nH),
      viewport: [cell[0], cell[1], cell[2], cell[3]],
    }),
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
  ambientLight: components.ambientLight({ intensity: 0.01 }),
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
    bulbRadius: 0.3,
  }),
  // lightHelper: components.lightHelper(),
});
world.add(directionalLightEntity);

const fixDirectionalLightEntity = createEntity({
  layer: LAYERS[0],
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [1, 1, 1], [0, 0, 0]),
  }),
  directionalLight: components.directionalLight(),
  // lightHelper: components.lightHelper(),
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
    bulbRadius: 0.03,
  }),
  // lightHelper: components.lightHelper(),
});
world.add(spotLightEntity);

const fixSpotLightEntity = createEntity({
  layer: LAYERS[1],
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.fromPointToPoint(quat.create(), [1, 1, 1], [0, 0, 0]),
  }),
  spotLight: components.spotLight(),
  // lightHelper: components.lightHelper(),
});
world.add(fixSpotLightEntity);

// Point
const pointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({ position: [-1, 1, -1] }),
  pointLight: components.pointLight({
    color: [1, 1, 0, 1],
    intensity: 1,
    range: 5,
    bulbRadius: 0.1,
  }),
  // lightHelper: components.lightHelper(),
});
world.add(pointLightEntity);

const fixPointLightEntity = createEntity({
  layer: LAYERS[2],
  transform: components.transform({ position: [1, 1, 1] }),
  pointLight: components.pointLight(),
  // lightHelper: components.lightHelper(),
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
    bulbRadius: 0.1,
  }),
  // lightHelper: components.lightHelper(),
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
  // lightHelper: components.lightHelper(),
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

gpu.frame(ctx, () => {
  if (State.animate) rotate(performance.now() * 0.001 * 0.1);

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntities);

  window.dispatchEvent(new CustomEvent("screenshot"));
});
