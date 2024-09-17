import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { quat, vec3 } from "pex-math";

import { icosphere, tetrahedron } from "primitive-geometry";

const pixelRatio = 1; //devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();
const gui = createGUI(ctx, { theme: { columnWidth: 200 } });

const viewportWidth = window.innerWidth * pixelRatio;
const viewportHeight = window.innerHeight * pixelRatio;
const aspect = ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
const columns = 2;
const rows = 1;
const viewWidth = viewportWidth / columns;
const viewHeight = viewportHeight / rows;

const postProcessing = components.postProcessing({
  // colorCorrection: { saturation: 0 },
  aa: components.postProcessing.aa({
    type: "fxaa3",
  }),
});

for (let i = 0; i < rows; i++) {
  const dy = i / rows;

  for (let j = 0; j < columns; j++) {
    const dx = j / columns;

    const viewport = [
      dx * viewportWidth,
      dy * viewportHeight,
      // Fake borders
      viewWidth - 1,
      viewHeight - 1,
    ];
    const offset = [dx * viewportWidth, viewHeight * (rows - 1) * 0.5];

    const cameraEntity = createEntity({
      transform: components.transform({
        position: [0, 0, 5],
      }),
      camera: components.camera({
        aspect,
        viewport,
        view: {
          offset,
          size: [viewWidth, viewHeight],
          totalSize: [viewportWidth, viewportHeight],
        },
        fov: Math.PI / 2,
        clearColor: [1, 1, 1, 1],
      }),
      orbiter: components.orbiter({ element: ctx.gl.canvas }),
      ...(j === 1 ? { postProcessing } : {}),
    });
    world.add(cameraEntity);
  }
}

const axesEntity = createEntity({ axesHelper: components.axesHelper() });
world.add(axesEntity);

const icosphereGeometry = icosphere({ radius: 4 });

const tetrahedronEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    ...tetrahedron(),
    offsets: icosphereGeometry.positions,
    instances: icosphereGeometry.positions.length / 3,
  }),
  material: components.material({
    baseColor: [1, 0, 0, 1],
  }),
});
world.add(tetrahedronEntity);

// const skyEntity = createEntity({
//   skybox: components.skybox({ sunPosition: [0, 0.05, -1] }),
//   reflectionProbe: components.reflectionProbe(),
// });
// world.add(skyEntity);

const lightEntity = createEntity({
  transform: components.transform({
    position: [3, 3, 3],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([-5, -2, -3])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 5,
    castShadows: true,
    bias: 0.01,
  }),
});
world.add(lightEntity);

// GUI
gui.addRadioList(
  "AA Type",
  postProcessing.aa,
  "type",
  ["fxaa2", "fxaa3"].map((value) => ({ name: value, value })),
);
gui.addParam("Luma Threshold Min", postProcessing.aa.lumaThreshold, "0", {
  min: 0.00001,
  max: 1,
  // min: 1 / 128,
  // max: 1 / 12,
});
gui.addParam("Luma Threshold Max", postProcessing.aa.lumaThreshold, "1", {
  min: 0.00001,
  max: 1,
  // min: 1 / 32,
  // max: 1 / 4,
});
gui.addParam("SubPixelQuality", postProcessing.aa, "subPixelQuality", {
  min: 0,
  max: 1,
  step: 0.25,
});
gui.addParam("Span Max", postProcessing.aa, "spanMax", {
  min: 2,
  max: 16,
  step: 1,
});

ctx.frame(() => {
  renderEngine.update(world.entities);
  const renterTargets = renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
