import createRenderer from "../index.js";
import createContext from "pex-context";
import { sphere, torus } from "primitive-geometry";
import { quat } from "pex-math";

const ctx = createContext({ type: "webgl" });
const renderer = createRenderer(ctx);

const cameraEntity = renderer.entity({
  transform: renderer.transform({ position: [0, 0, 3] }),
  camera: renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: renderer.orbiter({
    element: ctx.gl.canvas,
  }),
});

renderer.add(cameraEntity);

const sphereEntity = renderer.entity({
  transform: renderer.transform({
    position: [1, 0, 0],
  }),
  geometry: renderer.geometry(sphere()),
  material: renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
renderer.add(sphereEntity);

const torusEntity = renderer.entity({
  transform: renderer.transform({
    position: [-1, 0, 0],
  }),
  geometry: renderer.geometry(torus({ radius: 1 })),
  material: renderer.material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
  }),
});
renderer.add(torusEntity);

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

renderer.addSystem(renderer.cameraSystem());
renderer.addSystem(renderer.geometrySystem());
renderer.addSystem(renderer.transformSystem());

ctx.frame(() => {
  const now = Date.now() * 0.0005;

  skyboxEntity.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  quat.fromAxisAngle(
    torusEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  torusEntity.transform.dirty = true; //UGH
  renderer.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
