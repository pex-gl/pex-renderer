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
import parseHdr from "parse-hdr";

import { debugSceneTree, getURL } from "./utils.js";
import { aabb } from "pex-geom";

random.seed(0);

const {
  camera,
  directionalLight,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
} = components;

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });

const world = (window.world = createWorld());
const renderEngine = createRenderEngine({ ctx });

// Entities
const cameraEntity = createEntity({
  transform: transform({ position: [15, 1, 15] }),
  camera: camera({
    fov: Math.PI * 0.1,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const floorEntity = createEntity({
  transform: transform({ position: [0, -1.6, 0] }),
  geometry: geometry(cube({ sx: 20, sy: 0.01, sz: 20 })),
  material: material({
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
// TODO: is it needed
floorEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  floorEntity.geometry.positions
);

const transmissionBlendOptions = {
  blend: true,
  blendSrcRGBFactor: ctx.BlendFactor.One,
  blendSrcAlphaFactor: ctx.BlendFactor.One,
  blendDstRGBFactor: ctx.BlendFactor.Zero,
  blendDstAlphaFactor: ctx.BlendFactor.Zero,
};

const torusEntity = createEntity({
  transform: transform({ position: [0, 0.2, 0] }),
  geometry: geometry(torus({ radius: 1.5, minorRadius: 0.2 })),
  material: material({
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
  transform: transform(),
  geometry: geometry(sphere({ radius: 1 })),
  material: material({
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
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry({
    //...roundedCube({ sx: 0.5, sy: 0.5, sz: 0.5, radius: 0.05 }),
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
  material: material({
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
  transform: transform({
    position: [0, 0, 0],
  }),
  geometry: geometry({
    ...roundedCube({ sx: 1, sy: 1, sz: 1, radius: 0.05 }),
    offsets: g2.positions,
    scales: g2.scales,
    instances: g2.positions.length,
  }),
  material: material({
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

const hdrImg = parseHdr(
  await io.loadArrayBuffer(
    // getURL(`assets/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`)
    getURL(`assets/envmaps/garage/garage.hdr`)
  )
);
const envMap = ctx.texture2D({
  data: hdrImg.data,
  width: hdrImg.shape[0],
  height: hdrImg.shape[1],
  pixelFormat: ctx.PixelFormat.RGBA32F,
  encoding: ctx.Encoding.Linear,
  min: ctx.Filter.Linear,
  mag: ctx.Filter.Linear,
  flipY: true,
});

const skyEntity = createEntity({
  skybox: skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true,
    envMap,
  }),
  reflectionProbe: reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [-2, 2, 0]),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity);

const directionalLightEntity2 = createEntity({
  transform: transform({
    position: [1, 1, 1],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [2, 2, -2]),
  }),
  directionalLight: directionalLight({
    color: [1, 1, 1, 2], //FIXME: instencity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
    bias: 0.03,
  }),
});
world.add(directionalLightEntity2);

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();

gui.addButton("Tree", () => {
  debugSceneTree(world.entities);
});

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio,
    width: window.innerWidth,
    height: window.innerHeight,
  });
  cameraEntity.camera.aspect = window.innerWidth / window.innerHeight;
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
  torusEntity.transform.dirty = true; //UGH

  renderEngine.update(world.entities);
  renderEngine.render(world.entities, cameraEntity);

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
