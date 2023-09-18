import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  systems,
  components,
} from "../index.js";

import createContext from "pex-context";
import random from "pex-random";
import { cube, sphere } from "primitive-geometry";

random.seed("0");

const ctx = createContext({ pixelRatio: devicePixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
window.renderEngine = renderEngine;

// renderEngine.renderers[0] = systems.renderer.basic({
//   ctx,
//   resourceCache: renderEngine.resourceCache,
//   renderGraph: renderEngine.renderGraph,
// });
// renderEngine.debug(true);

const world = (window.world = createWorld());

const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 0, 5] }),
  camera: components.camera(),
  orbiter: components.orbiter(),
});
world.add(cameraEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [1, 0.5, 1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

// const simpleGeometryEntity = createEntity({
//   transform: components.transform({ position: [0, 0, 0] }),
//   geometry: components.geometry(sphere()),
//   material: components.material({
//     baseColor: [1, 0, 0, 1],
//   }),
// });
// world.add(simpleGeometryEntity);
// const simpleGeometryBlendEntity = createEntity({
//   transform: components.transform({ position: [1, 0, 0] }),
//   geometry: components.geometry(sphere()),
//   material: components.material({
//     // id: "1",
//     baseColor: [0, 1, 0, 0.5],
//     // blend: true,
//   }),
// });
// world.add(simpleGeometryBlendEntity);

const INSTANCE_COUNT = 32;
const geometryInstancedEntity = createEntity({
  transform: components.transform({ position: [-1, 0, 0] }),
  geometry: components.geometry({
    ...sphere(),
    scales: new Float32Array(INSTANCE_COUNT * 3).fill(0.2),
    offsets: new Float32Array(INSTANCE_COUNT * 3).map(() =>
      random.float(-1, 1)
    ),
    instances: INSTANCE_COUNT,
    attributes: {
      aInstanceTest: ctx.vertexBuffer(
        new Float32Array(INSTANCE_COUNT * 3).fill(0.2)
      ),
    },
  }),
  material: components.material({
    baseColor: [0, 0, 1, 1],
  }),
});
world.add(geometryInstancedEntity);
window.addEventListener("click", () => {
  geometryInstancedEntity.geometry = sphere();
  console.log("geometryInstancedEntity", geometryInstancedEntity);
});
// const geometryInstanced2Entity = createEntity({
//   transform: components.transform({ position: [-1, 0, 0] }),
//   geometry: components.geometry({
//     ...sphere(),
//     scales: new Float32Array(INSTANCE_COUNT * 3).fill(0.2),
//     offsets: new Float32Array(INSTANCE_COUNT * 3).map(() =>
//       random.float(-1, 1)
//     ),
//     instances: INSTANCE_COUNT,
//   }),
//   material: components.material({
//     baseColor: [0.5, 0, 1, 1],
//   }),
// });
// world.add(geometryInstanced2Entity);

// const cubeGeometry = cube();
// console.log(cubeGeometry.positions.length);
// const geometryInstancedVertexColorsEntity = createEntity({
//   transform: components.transform({ position: [1, 0, 0] }),
//   geometry: components.geometry({
//     ...cubeGeometry,
//     scales: new Float32Array(INSTANCE_COUNT * 3).fill(0.2),
//     offsets: new Float32Array(INSTANCE_COUNT * 3).map(() =>
//       random.float(-1, 1)
//     ),
//     instances: INSTANCE_COUNT,
//     // colors: new Float32Array(INSTANCE_COUNT * 4).map((_, i) =>
//     //   i % 4 === 2 ? 1 : 1
//     // ),
//     vertexColors: new Float32Array((cubeGeometry.positions.length / 3) * 4).map(
//       (_, index) => (index % 4 === 0 ? 0.5 : random.float())
//     ),
//   }),
//   material: components.material({
//     baseColor: [1, 1, 1, 1],
//   }),
// });
// world.add(geometryInstancedVertexColorsEntity);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);
});
