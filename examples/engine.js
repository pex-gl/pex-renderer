import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { cube } from "primitive-geometry";

const ctx = createContext({ pixelRatio: devicePixelRatio });
const renderEngine = createRenderEngine({ ctx });

const world = createWorld();

const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 3, 3] }),
  camera: components.camera(),
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [1, 0.5, 1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const geometryEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube({ sx: 0.5 })),
  material: components.material(),
  vertexHelper: components.vertexHelper({ size: 0.2 }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(geometryEntity);

const helpersEntity = createEntity({
  gridHelper: components.gridHelper(),
  axesHelper: components.axesHelper(),
});
world.add(helpersEntity);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);
});
