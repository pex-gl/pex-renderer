import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "pex-renderer";

import * as gpu from "pex-gpu";
import { cube } from "primitive-geometry";

const ctx = await gpu.createContext({ pixelRatio: devicePixelRatio });
const renderEngine = createRenderEngine({ ctx });

const world = createWorld();

const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 3, 3] }),
  camera: components.camera(),
  orbiter: components.orbiter({ element: ctx.canvas }),
});
world.add(cameraEntity);

const skyboxEntity = createEntity({
  transform: components.transform(),
  // Skylight only — nothing here pairs a directional light with the sky, so the
  // sun has to be high enough for the sky alone to carry the scene. At 45
  // degrees it delivers about 17 000 lx, a stop under the daylight the default
  // exposure meters for, which is what skylight without direct sun looks like.
  skybox: components.skybox({ sunPosition: [0, 1, -1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyboxEntity);

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

gpu.frame(ctx, async () => {
  renderEngine.update(world.entities);
  await renderEngine.render(world.entities, cameraEntity);

  window.dispatchEvent(new CustomEvent("screenshot"));
});
