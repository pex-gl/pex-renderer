import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat, vec3 } from "pex-math";
import createGUI from "pex-gui";
import random from "pex-random";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 0, 35] }),
  camera: components.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 10000,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const axesHelperEntity = createEntity({
  axesHelper: true,
});
world.add(axesHelperEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [0, 5, -5] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [0, 2, 0],
    rotation: quat.fromDirection(quat.create(),[0, -1, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 0, 0, 1],
    intensity: 10,
  }),
});
world.add(directionalLightEntity);

// Curl noise
const snoiseVec3 = (x, y, z) => [
  random.noise3(x, y, z),
  random.noise3(y - 19.1, z + 33.4, x + 47.2),
  random.noise3(z + 74.2, x - 124.5, y + 99.4),
];

const curlNoise = (p) => {
  const e = 0.91;

  const px0 = snoiseVec3(p[0] - e, p[1], p[2]);
  const px1 = snoiseVec3(p[0] + e, p[1], p[2]);
  const py0 = snoiseVec3(p[0], p[1] - e, p[2]);
  const py1 = snoiseVec3(p[0], p[1] + e, p[2]);
  const pz0 = snoiseVec3(p[0], p[1], p[2] - e);
  const pz1 = snoiseVec3(p[0], p[1], p[2] + e);

  const x = py1[2] - py0[2] - pz1[1] + pz0[1];
  const y = pz1[0] - pz0[0] - px1[2] + px0[2];
  const z = px1[1] - px0[1] - py1[0] + py0[0];

  const divisor = 1 / (2 * e);
  return vec3.scale(vec3.normalize([x, y, z]), divisor);
};

const createParticleSystem = () => ({
  type: "particle-system",
  cache: {},

  getValue(field, size, [x, y, z]) {
    x += size / 2;
    y += size / 2;
    z += size / 2;

    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);

    return field[x]?.[y]?.[z];
  },

  updateParticles(entity) {
    const {
      fieldSize,
      scale = 0.25,
      steer = 0.01,
      modding = 0.11,
      particleCount = 100,
    } = entity.particles;

    if (!this.cache[entity.id]) {
      this.cache[entity.id] = {
        field: Array.from({ length: fieldSize }, (a, x) =>
          Array.from({ length: fieldSize }, (b, y) =>
            Array.from({ length: fieldSize }, (c, z) =>
              curlNoise(
                [x - fieldSize / 2, y - fieldSize / 2, z - fieldSize / 2].map(
                  (p) => p * modding,
                ),
              ),
            ),
          ),
        ),
        particles: Array.from({ length: particleCount }, () => {
          const position = random.vec3();

          return {
            initialPosition: position,
            currentPosition: vec3.copy(position),
            velocity: vec3.create(),
          };
        }),
      };
    }

    const particles = this.cache[entity.id].particles;
    const field = this.cache[entity.id].field;

    particles.forEach((particle) => {
      let value = this.getValue(field, fieldSize, particle.currentPosition);

      if (value) {
        value = vec3.copy(value);
        vec3.normalize(value);
        vec3.scale(value, scale);

        const steering = vec3.sub(value, particle.velocity);
        vec3.normalize(steering);
        vec3.scale(steering, steer);

        vec3.add(particle.velocity, steering);
        vec3.add(particle.currentPosition, particle.velocity);
      } else {
        // particle.currentPosition = vec3.copy(particle.initialPosition);
        particle.currentPosition = random.vec3();
        particle.velocity = vec3.create();
      }
    });

    Object.assign(entity.geometry, {
      positions: particles.map(({ currentPosition }) => currentPosition),
      vertexColors: particles.map(({ velocity }) => {
        const [r, g, b] = velocity;
        return [r * 6, 0.2 + 0.8 * g, 0.2 + 0.8 * b, 1];
      }),
    });
    entity.geometry.positions.dirty = true;
    entity.geometry.vertexColors.dirty = true;
  },

  update(entities) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];

      if (entity.particles) {
        this.updateParticles(entity);
      }
    }
  },
});

const particleCount = 50000;
const particleEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    count: particleCount,
    primitive: ctx.Primitive.Points,
  }),
  material: components.material({
    pointSize: 5,
    baseColor: [1, 1, 1, 1],
  }),
  particles: {
    fieldSize: 30,
    particleCount,
  },
});
world.add(particleEntity);

const particleSystem = createParticleSystem();

particleSystem.update(world.entities);

// GUI
const gui = createGUI(ctx);
gui.addParam("Point size", particleEntity.material, "pointSize", {
  min: 0.5,
  max: 40,
});

ctx.frame(() => {
  particleSystem.update(world.entities);

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
