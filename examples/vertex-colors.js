import createRenderer from "../index.js";
import createContext from "pex-context";
import { cube } from "primitive-geometry";
import random from "pex-random";

random.seed(0);

const ctx = createContext();

const renderer = createRenderer({
  ctx,
});

const camera = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
  }),
  renderer.orbiter({ position: [1, 1, 1] }),
]);
renderer.add(camera);

const geometry = cube();
geometry.vertexColors = new Float32Array(
  (geometry.positions.length / 3) * 4
).map((_, index) => (index % 4 === 0 ? 0.5 : random.float()));

const cubeEntity = renderer.entity([
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [1, 1, 1, 0.5],
    unlit: true,
  }),
]);
renderer.add(cubeEntity);

const ambientLightEntity = renderer.entity([renderer.ambientLight()]);
renderer.add(ambientLightEntity);

ctx.frame(() => {
  renderer.draw();
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
