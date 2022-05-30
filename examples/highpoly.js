import createRenderer from "../index.js";

import createContext from "pex-context";
import { vec3 } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

import { sphere } from "primitive-geometry";
import { computeNormals } from "./utils.js";

const ctx = createContext();
const renderer = createRenderer(ctx);

const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addHeader("Meshes");

random.seed(0);

const cameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  renderer.orbiter({
    position: [0, 0, 3],
  }),
]);
renderer.add(cameraEntity);

const geom = sphere({ radius: 1, nx: 400, ny: 400 });
const scale = 1;

function perlin(p) {
  let s = scale;
  let n = 0;
  for (let i = 0; i < 5; i++) {
    n += random.noise3(p[0] * s, p[1] * s, p[2] * s) / s;
    s *= 2;
  }
  return n;
}

for (let i = 0; i < geom.positions.length / 3; i++) {
  const index = i * 3;
  const position = geom.positions.slice(index, index + 3);
  const normal = geom.normals.slice(index, index + 3);
  const n = perlin(position);
  vec3.addScaled(position, normal, n * 0.1);
  geom.positions.set(position, index);
}

geom.normals = computeNormals(geom.positions, geom.cells);

const sphereEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(geom),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    roughness: 0.096,
    metallic: 0,
    cullFace: false,
  }),
]);
renderer.add(sphereEntity);
gui.addLabel(`Sphere verts: ${geom.positions.length}`);

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
