import createRenderer from "../index.js";
import createContext from "pex-context";
import createGUI from "pex-gui";
import { mat4, quat, vec3 } from "pex-math";
import random from "pex-random";
import { cube, sphere } from "primitive-geometry";
import cosineGradient from "cosine-gradient";

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: 0,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
};
random.seed(10);

// Utils
const scheme = [
  [0.0, 0.5, 0.5],
  [0.0, 0.5, 0.5],
  [0.0, 0.5, 0.333],
  [0.0, 0.5, 0.667],
];

// Standard Normal constiate using Box-Muller transform.
// http://stackoverflow.com/a/36481059
function randnBM() {
  const u = 1 - Math.random(); // Subtraction to flip [0, 1) to (0, 1].
  const v = 1 - Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function rand() {
  return (Math.random() * 2 - 1) * 3;
}

const gradient = cosineGradient(scheme[0], scheme[1], scheme[2], scheme[3]);

// Start
const ctx = createContext({
  type: "webgl",
});

const renderer = createRenderer(ctx);
window.renderer = renderer;

function aabbToString(aabb) {
  if (!aabb) return "[]";
  return `[${aabb[0].map((f) => f.toFixed(0.1))} .. ${aabb[1].map((f) =>
    f.toFixed(0.1)
  )}]`;
}

function debugScene() {
  let s = "";
  renderer.entities.forEach((e, i) => {
    let pad = "";
    let transform = e.transform;
    while (transform) {
      pad += "--";
      transform = transform.parent;
    }
    let bbox = aabbToString(e.transform?.worldBounds);
    s += `${pad} ${i} ${e.name} ${Object.keys(e).join(" | ")} | ${bbox} \n`;
  });
  console.log(s);
  console.log("renderer.entities", renderer.entities);
}

const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addButton("Debug scene", debugScene);

let frameNumber = 0;
let debugOnce = false;

// Camera
const cameraEntity = renderer.entity({
  // renderer.postProcessing({
  //   ssao: true,
  //   ssaoRadius: 4,
  //   dof: true,
  //   dofAperture: 1,
  //   dofFocusDistance: 5,
  //   fxaa: true,
  // }),
  transform: renderer.transform(),
  camera: renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    exposure: 2,
  }),
  orbiter: renderer.orbiter({
    position: [0, 3, 8],
    element: ctx.gl.canvas,
  }),
});
renderer.add(cameraEntity);

// Meshes
const floorEntity = renderer.entity({
  transform: renderer.transform({
    position: [0, -0.3, 0],
  }),
  geometry: renderer.geometry(cube({ sx: 14, sy: 0.02, sz: 14 })),
  material: renderer.material({
    baseColor: [1, 1, 1, 1],
    // castShadows: true,
    // receiveShadows: true,
    depthTest: true,
    depthWrite: true,
    // unlit: true,
    roughness: 1,
    metallic: 1,
  }),
});
renderer.add(floorEntity);

let instanced = true;
const geom = cube({ sx: 0.2, sy: 0.5 + Math.random(), sz: 0.2 });
const offsets = [];
const scales = [];
const colors = [];
for (let i = 0; i < 1000; i++) {
  const x = (randnBM() * 8) / 3;
  const z = (randnBM() * 8) / 3;
  const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z);
  const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2);
  const c = random.float(0.7, 0.9);
  offsets.push([x, y, z]);
  scales.push([1, s, 1]);
  colors.push([c, c, c, 1]);
}
if (instanced) {
  geom.offsets = { buffer: ctx.vertexBuffer(offsets), divisor: 1 };
  geom.scales = { buffer: ctx.vertexBuffer(scales), divisor: 1 };
  geom.instances = offsets.length;
  const ent = renderer.entity({
    geometry: renderer.geometry(geom),
    transform: renderer.transform({}),
    material: renderer.material({
      baseColor: colors[0],
      rougness: 0.7,
      metallic: 0.0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  renderer.add(ent); //TODO
} else {
  offsets.forEach((offset, i) => {
    const ent = renderer.entity({
      geometry: renderer.geometry(geom),
      transform: renderer.transform({
        position: offset,
        scale: scales[i],
      }),
      material: renderer.material({
        baseColor: colors[i],
        rougness: 0.7,
        metallic: 0.0,
        castShadows: true,
        receiveShadows: true,
      }),
    });
    renderer.add(ent); //TODO:
  });
}

const sphereGeometry = sphere({ radius: 0.2 + Math.random() * 0.25 });
for (let i = 0; i < 100; i++) {
  const x = (rand() * 8) / 3;
  const z = (rand() * 8) / 3;
  const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z);
  const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2);
  const ent = renderer.entity({
    geometry: renderer.geometry(sphereGeometry),
    transform: renderer.transform({
      position: [x, y, z],
      scale: [s, s, s],
    }),
    material: renderer.material({
      baseColor: gradient(Math.random()).concat(1),
      rougness: 0.91,
      metallic: 0.0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  renderer.add(ent); //TODO:
}

// Lights
const sunDir = vec3.normalize([1, -1, 1]);
const sunPosition = vec3.addScaled([0, 0, 0], sunDir, -2);
const sunLight = renderer.directionalLight({
  color: [1, 1, 1, 2],
  intensity: 2, //TODO: not working light intensity
  castShadows: true,
  bias: 0.1,
});
const sunTransform = renderer.transform({
  position: [0.1, 2, 0.1],
  rotation: quat.fromTo([0, 0, 1], [0, 0, 1], vec3.normalize([-1, -1, -1])),
});
const sunEntity = renderer.entity({
  transform: sunTransform,
  directionalLight: sunLight,
});
renderer.add(sunEntity);

const skyboxCmp = renderer.skybox({
  sunPosition,
});
const reflectionProbeCmp = renderer.reflectionProbe();
const skyEntity = renderer.entity({
  skybox: skyboxCmp,
  reflectionProbe: reflectionProbeCmp,
});
renderer.add(skyEntity);

const pointLightEnt = renderer.entity({
  transform: renderer.transform({
    position: [2, 2, 2],
  }),
  // geometry: renderer.geometry(sphere({ radius: 0.2 })),
  material: renderer.material({
    baseColor: [1, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1],
  }),
  pointLight: renderer.pointLight({
    // castShadows: true,
    color: [1, 0, 0, 1],
    intensity: 5,
  }),
});
// renderer.add(pointLightEnt);

const areaLightColor = [0, 1, 0, 1];
const areaLightEntity = renderer.entity({
  transform: renderer.transform({
    position: [5, 2, 0],
    scale: [2, 5, 0.1],
    rotation: quat.fromTo(quat.create(), [0, 0, 1], [-1, 0, 0], [0, 1, 0]),
  }),
  // geometry: renderer.geometry(cube({ sx: 1 })),
  material: renderer.material({
    emissiveColor: areaLightColor,
    baseColor: [0, 0, 0, 1],
    metallic: 1.0,
    roughness: 0.74,
  }),
  areaLight: renderer.areaLight({
    intensity: 5,
    color: areaLightColor,
  }),
});
// renderer.add(areaLightEntity);

// GUI
gui.addParam(
  "AreaLight Size",
  areaLightEntity.transform,
  "scale",
  { min: 0, max: 5 },
  (value) => {
    areaLightEntity.transform.set({ scale: [value[0], value[1], value[2]] });
  }
);
gui.addParam("AreaLight Intensity", areaLightEntity.areaLight, "intensity", {
  min: 0,
  max: 5,
});
gui.addParam("AreaLight", areaLightEntity.areaLight, "color", {
  type: "color",
});

function updateSunPosition() {
  mat4.identity(State.elevationMat);
  mat4.identity(State.rotationMat);
  mat4.rotate(State.elevationMat, (State.elevation / 180) * Math.PI, [0, 0, 1]);
  mat4.rotate(State.rotationMat, (State.azimuth / 180) * Math.PI, [0, 1, 0]);

  const sunPosition = [2, 0, 0];
  vec3.multMat4(sunPosition, State.elevationMat);
  vec3.multMat4(sunPosition, State.rotationMat);

  const dir = vec3.normalize(vec3.sub([0, 0, 0], sunPosition));
  // TODO:
  // sunTransform.set({
  //   position: sunPosition,
  //   rotation: quat.fromTo(sunTransform.rotation, [0, 0, 1], dir, [0, 1, 0]),
  // });
  // skyboxCmp.set({ sunPosition });
  // reflectionProbeCmp.set({ dirty: true });
}
gui.addParam(
  "Sun Elevation",
  State,
  "elevation",
  { min: -90, max: 180 },
  updateSunPosition
);

updateSunPosition();

window.addEventListener("keydown", ({ key }) => {
  if (key === "d") debugOnce = true;
});

renderer.addSystem(renderer.geometrySystem());
renderer.addSystem(renderer.transformSystem());
renderer.addSystem(renderer.cameraSystem());
renderer.addSystem(renderer.skyboxSystem());
renderer.addSystem(renderer.reflectionProbeSystem());
renderer.addSystem(renderer.renderSystem());

let shadowMapPreview;

ctx.frame(() => {
  ctx.debug(frameNumber++ === 1);
  ctx.debug(debugOnce);
  debugOnce = false;
  renderer.draw();

  if (sunLight._shadowMap && !shadowMapPreview) {
    shadowMapPreview = gui.addTexture2D("Shadow Map", sunLight._shadowMap); //TODO
  }

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
