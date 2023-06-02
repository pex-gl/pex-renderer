import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import createGUI from "pex-gui";
import { quat, vec3, utils, avec3, avec4 } from "pex-math";
import { cube } from "primitive-geometry";
import cosineGradient from "cosine-gradient";

const {
  camera,
  geometry,
  material,
  orbiter,
  skybox,
  directionalLight,
  transform,
} = components;

// Utils
const ctx = createContext({ pixelRatio: devicePixelRatio });

const renderEngine = createRenderEngine({ ctx });
const world = createWorld();

const gui = createGUI(ctx, { scale: 1 });

let debugOnce = false;
const N = 15;
const instances = N * N * N;
let time = 0;
let prevTime = 0;

const scheme = [
  [0.65, 0.5, 0.31],
  [-0.65, 0.5, 0.6],
  [0.333, 0.278, 0.278],
  [0.66, 0.0, 0.667],
];
const scheme2 = [
  [0.5, 0.5, 0.0],
  [0.5, 0.5, 0.0],
  [0.1, 0.5, 0.0],
  [0.0, 0.0, 0.0],
];
const gradient = cosineGradient(scheme);
const gradient2 = cosineGradient(scheme2);

const cameraEntity = createEntity({
  transform: transform({ position: [3, 3, 3] }),
  camera: camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter(),
});
world.add(cameraEntity);

let instancedGeometry = {
  ...cube({ sx: (0.75 * 2) / N }),
  offsets: { data: new Float32Array(instances * 3), divisor: 1 },
  scales: {
    data: Float32Array.from({ length: instances * 3 }, (_, i) =>
      i % 3 === 2 ? 1 : 1
    ),
    divisor: 1,
  },
  rotations: { data: new Float32Array(instances * 4), divisor: 1 },
  colors: { data: new Float32Array(instances * 4), divisor: 1 },
  instances,
};

const geometryEntity = createEntity({
  transform: transform(),
  geometry: geometry(instancedGeometry),
  material: material({
    baseColor: [0.9, 0.9, 0.9, 1],
    roughness: 0.01,
    metallic: 1.0,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(geometryEntity);

const sunEntity = createEntity({
  transform: transform({
    position: [-2, 2, 2],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([2, -2, -1])
    ),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 0.95, 2],
    intensity: 2,
    castShadows: false,
  }),
});
world.add(sunEntity);

const skyboxEntity = createEntity({
  transform: transform(),
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1,
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyboxEntity);

function update() {
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
          Math.sqrt(Math.max(0.01, 1 - value - value2))
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
          quat.fromTo(quat.create(), [0, 0, 1], dir),
          0
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
gui.addFPSMeeter();

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  const now = Date.now();
  const deltaTime = (now - prevTime) / 1000;
  prevTime = now;
  time += deltaTime;

  ctx.debug(debugOnce);
  debugOnce = false;

  update();

  renderEngine.update(world.entities, deltaTime);
  renderEngine.render(world.entities, cameraEntity);

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
