import createContext from "pex-context";
import createRenderer from "../index.js";
import createGUI from "pex-gui";
import { cube } from "primitive-geometry";
import axisHelper from "../helpers/axis-helper.js";

const ctx = createContext();
const gui = createGUI(ctx);

const renderer = createRenderer(ctx);

const viewportWidth = window.innerWidth;
const viewportHeight = window.innerHeight;
const aspect = ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
const columns = 4;
const rows = 3;
const viewWidth = viewportWidth / columns;
const viewHeight = viewportHeight / rows;
const viewSize = 5;

for (let i = 0; i < rows; i++) {
  const dy = i / rows;

  let projection = i % 2 === 0 ? "perspective" : "orthographic";
  // projection = 'orthographic'
  // projection = 'perspective'

  const header = gui.addHeader(`${projection} ${Math.floor(i / 2)}`);
  header.y = 15 + dy * viewportHeight;

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

    const camera = renderer.entity([
      renderer.camera({
        projection,
        exposure: j % 2 ? 2 : 1,
        aspect,
        viewport: [
          dx * viewportWidth,
          dy * viewportHeight,
          viewWidth,
          viewHeight,
        ],
        view: {
          offset: [dx * viewportWidth, viewHeight * (rows - 1) * 0.5],
          size: [viewWidth, viewHeight],
          totalSize: [viewportWidth, viewportHeight],
        },
        ...options,
      }),
      renderer.orbiter({ position: [1, 1, 1] }),
    ]);
    renderer.add(camera);
  }
}

const axesEntity = renderer.entity([axisHelper()]);
renderer.add(axesEntity);

const cubeEntity = renderer.entity([
  renderer.geometry(cube()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
  }),
]);
renderer.add(cubeEntity);

const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
]);
renderer.add(skybox);

const reflectionProbe = renderer.entity([renderer.reflectionProbe()]);
renderer.add(reflectionProbe);

ctx.frame(() => {
  renderer.draw();
  gui.draw();
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
