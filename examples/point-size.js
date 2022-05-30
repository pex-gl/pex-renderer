import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { vec3 } from "pex-math";
import random from "pex-random";

random.seed(0);

const ctx = createContext();
const renderer = createRenderer(ctx);
const gui = createGUI(ctx);

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
  }),
  renderer.orbiter({
    position: [0, 0, 35],
  }),
]);
renderer.add(cameraEntity);

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

class Curl {
  constructor(opts) {
    this.type = "Curl";
    this.size = 10;
    this.particleCount = 1000;
    this.modding = 0.11;
    this.scale = 0.25;
    this.steer = 0.01;

    this.set(opts);

    this.particles = Array.from({ length: this.particleCount }, () => {
      const position = random.vec3();

      return {
        initialPosition: position,
        currentPosition: vec3.copy(position),
        velocity: vec3.create(),
      };
    });
  }

  set(opts) {
    Object.assign(this, opts);
  }

  init(entity) {
    this.entity = entity;

    this.field = Array.from({ length: this.size }, (a, x) =>
      Array.from({ length: this.size }, (b, y) =>
        Array.from({ length: this.size }, (c, z) =>
          curlNoise(
            [x - this.size / 2, y - this.size / 2, z - this.size / 2].map(
              (p) => p * this.modding
            )
          )
        )
      )
    );
  }

  update() {
    this.particles.forEach((particle) => {
      let value = this.getValue(particle.currentPosition);

      if (value) {
        value = vec3.copy(value);
        vec3.normalize(value);
        vec3.scale(value, this.scale);

        const steering = vec3.sub(value, particle.velocity);
        vec3.normalize(steering);
        vec3.scale(steering, this.steer);

        vec3.add(particle.velocity, steering);
        vec3.add(particle.currentPosition, particle.velocity);
      } else {
        particle.currentPosition = vec3.copy(particle.initialPosition);
        particle.velocity = vec3.create();
      }
    });

    this.entity.getComponent("Geometry").set({
      positions: this.particles.map(({ currentPosition }) => currentPosition),
      colors: this.particles.map(({ velocity }) => {
        const [r, g, b] = velocity;
        return [r * 6, g, b, 1];
      }),
    });
  }

  getValue([x, y, z]) {
    x += this.size / 2;
    y += this.size / 2;
    z += this.size / 2;

    x = Math.round(x);
    y = Math.round(y);
    z = Math.round(z);

    return this.field[x] && this.field[x][y] && this.field[x][y][z]
      ? this.field[x][y][z]
      : undefined;
  }
}

const fieldSize = 30;
const particleCount = 30000;

const particleEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry({
    count: particleCount,
    primitive: ctx.Primitive.Points,
  }),
  renderer.material({
    pointSize: 0.8,
    unlit: true,
    baseColor: [1, 1, 1, 1],
  }),
  new Curl({
    size: fieldSize,
    particleCount,
  }),
]);
renderer.add(particleEntity);

gui.addParam(
  "Point size",
  particleEntity.getComponent("Material"),
  "pointSize",
  { min: 0.5, max: 40 }
);

ctx.frame(() => {
  renderer.draw();
  gui.draw();
});

setTimeout(() => {
  window.dispatchEvent(new CustomEvent("pex-screenshot"));
}, 10000);
