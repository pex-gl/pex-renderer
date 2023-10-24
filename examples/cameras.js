import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";

import { cube } from "primitive-geometry";

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();
const gui = createGUI(ctx, { theme: { columnWidth: 200 } });

const viewportWidth = window.innerWidth * pixelRatio;
const viewportHeight = window.innerHeight * pixelRatio;
const aspect = ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
const columns = 4;
const rows = 3;
const viewWidth = viewportWidth / columns;
const viewHeight = viewportHeight / rows;
const viewSize = 5;

for (let i = 0; i < rows; i++) {
  const dy = i / rows;

  const projection = i % 2 === 0 ? "perspective" : "orthographic";

  const header = gui.addHeader(`${projection} ${Math.floor(i / 2)}`);
  header.x = 10;
  header.y = 10 + ((i / rows) * viewportHeight) / pixelRatio;

  const options =
    projection === "orthographic"
      ? {
          left: (-0.5 * viewSize * aspect) / 2,
          right: (0.5 * viewSize * aspect) / 2,
          top: (0.5 * viewSize) / 2,
          bottom: (-0.5 * viewSize) / 2,
        }
      : {
          fov: Math.PI / 2,
        };

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

    const subHeader = gui.addLabel(
      `viewport: [${viewport.map((n) => n.toFixed(0))}]
view offset: [${offset.map((n) => n.toFixed(0))}]`,
    );
    subHeader.x = 10 + (dx * viewportWidth) / pixelRatio;
    subHeader.y = (dy * viewportHeight + viewHeight) / pixelRatio - 50;

    const cameraEntity = createEntity({
      transform: components.transform({
        position: [1, 1, 1],
      }),
      camera: components.camera({
        projection,
        aspect,
        viewport,
        view: {
          offset,
          size: [viewWidth, viewHeight],
          totalSize: [viewportWidth, viewportHeight],
        },
        ...options,
      }),
      orbiter: components.orbiter({ element: ctx.gl.canvas }),
    });
    world.add(cameraEntity);
  }
}

const axesEntity = createEntity({ axesHelper: components.axesHelper() });
world.add(axesEntity);

const cubeEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube()),
  material: components.material({
    baseColor: [1, 1, 0, 1],
    metallic: 1,
    roughness: 0.1,
  }),
});
world.add(cubeEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [0, 5, -5] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

ctx.frame(() => {
  renderEngine.update(world.entities);
  renderEngine.render(
    world.entities,
    world.entities.filter((entity) => entity.camera),
  );

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
