import {
  renderEngine as createRenderEngine,
  world as createWorld,
  entity as createEntity,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat } from "pex-math";
import * as io from "pex-io";
import createGUI from "pex-gui";
import random from "pex-random";

import { cube, torus, sphere, roundedCube } from "primitive-geometry";

import { getEnvMap, getURL } from "./utils.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const renderEngine = createRenderEngine({ ctx, debug: true });
const world = createWorld();

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [15, 1, 15] }),
  camera: components.camera({
    fov: Math.PI / 10,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const floorEntity = createEntity({
  transform: components.transform({ position: [0, -1.6, 0] }),
  geometry: components.geometry(cube({ sx: 20, sy: 0.01, sz: 20 })),
  material: components.material({
    // unlit: true,
    baseColor: [0.5, 0.5, 0.551, 1],
    metallic: 0,
    roughness: 1,
    receiveShadows: true,
    castShadows: true,

    // depthWrite: true,
    // blend: true,
    // blendSrcRGBFactor: ctx.BlendFactor.Zero,
    // blendSrcAlphaFactor: ctx.BlendFactor.Zero,
    // blendDstRGBFactor: ctx.BlendFactor.SrcColor,
    // blendDstAlphaFactor: ctx.BlendFactor.SrcAlpha,
  }),
});
world.add(floorEntity);

const transmissionBlendOptions = {
  blend: true,
  blendSrcRGBFactor: ctx.BlendFactor.One,
  blendSrcAlphaFactor: ctx.BlendFactor.One,
  blendDstRGBFactor: ctx.BlendFactor.Zero,
  blendDstAlphaFactor: ctx.BlendFactor.Zero,
};

const torusEntity = createEntity({
  transform: components.transform({ position: [0, 0.2, 0] }),
  geometry: components.geometry(torus({ radius: 1.5, minorRadius: 0.2 })),
  material: components.material({
    baseColor: [1.9, 0.5, 0.29, 0.75],
    metallic: 0,
    roughness: 0.05,
    receiveShadows: true,
    castShadows: true,
    transmission: 0.6,
    // refraction: 0.5,
    // ...transmissionBlendOptions,
    // blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    // blendSrcAlphaFactor: ctx.BlendFactor.SrcAlpha,
    // blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    // blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
  }),
});
world.add(torusEntity);

const sphereEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(sphere({ radius: 1 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.1,
  }),
});
world.add(sphereEntity);

const g = {
  positions: [],
  scales: [],
  colors: [],
};
const reveal = 0.2;

const colorPalette = [];
for (let i = 0; i < 6; i++) {
  colorPalette.push([
    random.float(1.4),
    random.float(1.4),
    random.float(1.4),
    1,
  ]);
}

for (let x = -1.75; x <= 2; x += 0.5) {
  for (let z = -1.75; z <= 2; z += 0.5) {
    for (let y = -0.75; y <= 1; y += 0.5) {
      if (x < 0.25 || y < 0.25 || z < 0.25) {
        let dx = 0;
        let dy = 0;
        let dz = 0;
        if (x < -0.25) dx -= 3 * reveal;
        if (y < -0.25) dy -= 3 * reveal;
        if (z < -0.25) dz -= 3 * reveal;
        if (x > 0.25) dx += 2 * reveal;
        if (y > 0.25) dy += 2 * reveal;
        if (z > 0.25) dz += 2 * reveal;
        if (random.chance(0.5)) continue;

        g.positions.push([x + dx, y + dy, z + dz]);
        g.scales.push([0.5, 0.5, 0.5]);
        // if (random.chance(0.5)) {
        g.colors.push(random.element(colorPalette));
        // } else {
        // g.colors.push([0.1, 0.1, 0.1, 1]);
        // }
      }
    }
  }
}

const g1 = {
  positions: [],
  scales: [],
  colors: [],
};

const g2 = {
  positions: [],
  scales: [],
  colors: [],
};

g.positions.forEach((p, i) => {
  if (random.chance(0.3)) {
    g1.positions.push(p);
    g1.scales.push(g.scales[i]);
    g1.colors.push(g.colors[i]);
  } else {
    g2.positions.push(p);
    g2.scales.push(g.scales[i]);
    g2.colors.push(g.colors[i]);
  }
});

const cubesEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.005 }),
    //offsets: new Array(32).fill(0).map(() => random.vec3(2)),
    offsets: g1.positions,
    scales: g1.scales,
    colors: g1.colors,
    // instances: 32,
    instances: g1.positions.length,
    bounds: [
      [-2, -2, -2],
      [2, 2, 2],
    ],
  }),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    // baseColor: [0.2, 0.5, 1, 1],
    metallic: 0,
    roughness: 0.15,
    // transmission: 0.6,
    refraction: 0.5,
    //opaque mesh = no blending, it will be handled by material
    // blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.Zero,
    blendDstAlphaFactor: ctx.BlendFactor.Zero,
    receiveShadows: true,
    castShadows: true,
  }),
});
world.add(cubesEntity);

const cubesEntity2 = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.05 }),
    offsets: g2.positions,
    scales: g2.scales,
    instances: g2.positions.length,
  }),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.5,
    transmission: 0.6,
    refraction: 0.1,
    receiveShadows: false,
    ...transmissionBlendOptions,
  }),
});
world.add(cubesEntity2);

const skyEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
    envMap: await getEnvMap(ctx, "assets/envmaps/garage/garage.hdr"),
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [-2, 2, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity);

const directionalLightEntity2 = createEntity({
  transform: components.transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [2, 2, -2]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 1, 1, 2],
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity2);

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addParam("Refraction", cubesEntity2.material, "refraction", {
  min: 0,
  max: 1,
});

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
  quat.fromAxisAngle(
    torusEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  torusEntity.transform.dirty = true;

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
