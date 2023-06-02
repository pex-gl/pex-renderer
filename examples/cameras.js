import createContext from "pex-context";
import createRenderer from "../index.js";
import { cube } from "primitive-geometry";

const ctx = createContext();

const renderer = createRenderer(ctx);

const viewportWidth = window.innerWidth * 0.5;
const viewportHeight = window.innerHeight;
const aspect = (ctx.gl.drawingBufferWidth * 0.5) / ctx.gl.drawingBufferHeight;

const cubeCount = 100;
const offset = 2;
const gridSize = 10;
const viewSize = gridSize / 2;

const perspectiveCamera = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 100,
    aspect,
    viewport: [0, 0, viewportWidth, viewportHeight],
  }),
  renderer.orbiter({ position: [10, 10, 10], maxDistance: 100 }),
]);
renderer.add(perspectiveCamera);

const orthographicCamera = renderer.entity([
  renderer.camera({
    projection: "orthographic",
    aspect,
    left: (-0.5 * viewSize * aspect) / 2,
    right: (0.5 * viewSize * aspect) / 2,
    top: (0.5 * viewSize) / 2,
    bottom: (-0.5 * viewSize) / 2,
    viewport: [window.innerWidth * 0.5, 0, viewportWidth, viewportHeight],
  }),
  renderer.orbiter({ position: [10, 10, 10], maxDistance: 100 }),
]);
renderer.add(orthographicCamera);

const geometry = cube();

for (let i = 0; i < cubeCount; i++) {
  const cubeEntity = renderer.entity([
    renderer.transform({
      position: [
        (i % gridSize) * offset - cubeCount / gridSize,
        0,
        ~~(i / gridSize) * offset - cubeCount / gridSize,
      ],
    }),
    renderer.geometry(geometry),
    renderer.material({
      baseColor: [0, 0.5, 1, 1],
      metallic: 0,
    }),
  ]);
  renderer.add(cubeEntity);
}

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

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
