import createRenderer from "../index.js";
import createContext from "pex-context";
import { sphere } from "primitive-geometry";

const ctx = createContext();
const renderer = createRenderer(ctx);

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
]);
renderer.add(cameraEntity);

const sphereEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry(sphere()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.5,
  }),
]);
renderer.add(sphereEntity);

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
  }),
]);
renderer.add(skyboxEntity);

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()]);
renderer.add(reflectionProbeEntity);

ctx.frame(() => {
  const now = Date.now() * 0.0005;

  const skybox = skyboxEntity.getComponent("Skybox");
  skybox.set({
    sunPosition: [1 * Math.cos(now), 1, 1 * Math.sin(now)],
  });

  renderer.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
