import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat, vec3, utils, avec3, avec4 } from "pex-math";
import createGUI from "pex-gui";

import { cube } from "primitive-geometry";
import cosineGradient from "cosine-gradient";

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const N = 15;
const instances = N * N * N;

const gradient = cosineGradient([
  [0.65, 0.5, 0.31],
  [-0.65, 0.5, 0.6],
  [0.333, 0.278, 0.278],
  [0.66, 0.0, 0.667],
]);
const gradient2 = cosineGradient([
  [0.5, 0.5, 0.0],
  [0.5, 0.5, 0.0],
  [0.1, 0.5, 0.0],
  [0.0, 0.0, 0.0],
]);

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 3, 3] }),
  camera: components.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const instancedGeometry = {
  ...cube({ sx: (0.75 * 2) / N }),
  offsets: { data: new Float32Array(instances * 3), divisor: 1 },
  scales: {
    data: Float32Array.from({ length: instances * 3 }, (_, i) =>
      i % 3 === 2 ? 1 : 1,
    ),
    divisor: 1,
  },
  rotations: { data: new Float32Array(instances * 4), divisor: 1 },
  colors: { data: new Float32Array(instances * 4), divisor: 1 },
  instances,
};

const geometryEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(instancedGeometry),
  material: components.material({
    baseColor: [0.9, 0.9, 0.9, 1],
    roughness: 0.01,
    metallic: 1.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(geometryEntity);

const sunEntity = createEntity({
  transform: components.transform({
    position: [-2, 2, 2],
    rotation: quat.fromDirection(quat.create(), vec3.normalize([2, -2, -1])),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 0.95, 2],
    intensity: 2,
    castShadows: false,
  }),
});
world.add(sunEntity);

const skyboxEntity = createEntity({
  transform: components.transform(),
  skybox: components.skybox({ sunPosition: [0, 0.05, -1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyboxEntity);

function update(time) {
  const center = [0.75, 0.75, 0.75];
  const radius = 1.25;

  const center2 = [-0.75, -0.75, 0.75];
  const radius2 = 1.25;

  center[0] = 1.15 * Math.sin(time);
  center[1] = 0.75 * Math.cos(time);

  center2[0] = -1.15 * Math.sin(time);
  center2[1] = 0.75 * Math.sin(time);
  center2[2] = 0.5 * Math.cos(time * 2) * Math.sin(time / 2);

  let i = 0;
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        const pos = [
          utils.map(x, 0, N, -1, 1),
          utils.map(y, 0, N, -1, 1),
          utils.map(z, 0, N, -1, 1),
        ];
        const dist = vec3.distance(pos, center);
        if (dist < radius) {
          const force = vec3.sub(vec3.copy(pos), center);
          vec3.normalize(force);
          vec3.scale(force, 1 - Math.sqrt(dist / radius));
          vec3.add(pos, force);
        }
        const dist2 = vec3.distance(pos, center2);
        if (dist2 < radius2) {
          const force = vec3.sub(vec3.copy(pos), center2);
          vec3.normalize(force);
          vec3.scale(force, 1 - Math.sqrt(dist2 / radius2));
          vec3.add(pos, force);
        }
        avec3.set(instancedGeometry.offsets.data, i, pos, 0);

        const value = Math.min(1, dist / radius);
        const value2 = Math.min(1, dist2 / radius2);
        const colorBase = [0.8, 0.1, 0.1, 1.0];
        const color = gradient(value);
        const color2 = gradient2(value2);
        vec3.lerp(
          colorBase,
          [0, 0, 0, 0],
          Math.sqrt(Math.max(0.01, 1 - value - value2)),
        );
        vec3.lerp(color, [0, 0, 0, 0], value);
        vec3.lerp(color2, [0, 0, 0, 0], value2);
        vec3.add(colorBase, color);
        vec3.add(colorBase, color2);

        avec4.set(instancedGeometry.colors.data, i, colorBase, 0);

        const dir = vec3.normalize(vec3.sub(vec3.copy(pos), center));
        avec4.set(
          instancedGeometry.rotations.data,
          i,
          quat.fromDirection(quat.create(), dir),
          0,
        );
        i++;
      }
    }
  }

  // Update the geometry
  // Unoptimised: geometryEntity.geometry = { ...instancedGeometry };
  instancedGeometry.offsets.dirty = true;
  instancedGeometry.colors.dirty = true;
  instancedGeometry.rotations.dirty = true;
}

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
  cameraEntity.camera.aspect = width / height;
  cameraEntity.camera.dirty = true;
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  ctx.debug(debugOnce);
  debugOnce = false;

  update(performance.now() * 0.001);

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
