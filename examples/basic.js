import createRenderer from "../index.js";
import createContext from "pex-context";
import { sphere } from "primitive-geometry";

const ctx = createContext();
const renderer = createRenderer(ctx);

const cameraEntity = renderer.entity({
  transform: renderer.transform({ position: [0, 0, 3] }),
  camera: renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
});

renderer.add(cameraEntity);

const sphereEntity = renderer.entity({
  transform: renderer.transform(),
  geometry: renderer.geometry(sphere()),
  material: renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
renderer.add(sphereEntity);

const skyboxEntity = renderer.entity({
  skybox: renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
});
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity({
  reflectionProbe: renderer.reflectionProbe(),
});
renderer.add(reflectionProbeEntity);

ctx.frame(() => {
  const now = Date.now() * 0.0005;

  skyboxEntity.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  renderer.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
