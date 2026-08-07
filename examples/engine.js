import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { cube } from "primitive-geometry";
import { quat } from "pex-math";

const ctx = await gpu.createContext({ pixelRatio: devicePixelRatio });
const renderEngine = createRenderEngine({ ctx });

const world = createWorld();

const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 3, 3] }),
  camera: components.camera(),
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const geometryEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube({ sx: 0.5 })),
  material: components.material(),
});
world.add(geometryEntity);

const axesEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    positions: [
      [0, 0, 0],
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
      [0, 0, 1],
    ],
    vertexColors: [
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [0, 1, 0, 1],
      [0, 1, 0, 1],
      [0, 0, 1, 1],
      [0, 0, 1, 1],
    ],
  }),
  material: components.material({ type: "line", lineWidth: 3 }),
});
world.add(axesEntity);

const skyboxEntity = createEntity({
  transform: components.transform(),
  skybox: components.skybox({ sunPosition: [0, 0.15, -1] }),
});
world.add(skyboxEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    rotation: quat.fromDirection(quat.create(), [0, 0, 1]),
  }),
  directionalLight: components.directionalLight(),
});
world.add(directionalLightEntity);

gpu.frame(ctx, () => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  window.dispatchEvent(new CustomEvent("screenshot"));
});
