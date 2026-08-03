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
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const geometryEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube({ sx: 0.5 })),
  material: components.material(),
});
world.add(geometryEntity);

gpu.frame(ctx, () => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  window.dispatchEvent(new CustomEvent("screenshot"));
});
