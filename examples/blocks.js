import {
  world as createWorld,
  entity as createEntity,
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
  components,
} from "../index.js";
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
  const u = 1 - random.float(); // Subtraction to flip [0, 1) to (0, 1].
  const v = 1 - random.float();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function rand() {
  return (random.float() * 2 - 1) * 3;
}

const gradient = cosineGradient(scheme[0], scheme[1], scheme[2], scheme[3]);

// Start
const ctx = createContext();
const world = createWorld();
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

function aabbToString(aabb) {
  if (!aabb) return "[]";
  return `[${aabb[0].map((f) => f.toFixed(0.1))} .. ${aabb[1].map((f) =>
    f.toFixed(0.1),
  )}]`;
}

function debugScene() {
  let s = "";
  world.entities.forEach((e, i) => {
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
  console.log("world.entities", world.entities);
}

const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addButton("Debug scene", debugScene);

let frameNumber = 0;
let debugOnce = false;

// Camera
const cameraEntity = createEntity({
  transform: components.transform(),
  camera: components.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    exposure: 2,
  }),
  postProcessing: components.postProcessing({
    ssao: components.postProcessing.ssao({ radius: 4 }),
    dof: components.postProcessing.dof({ focusDistance: 5 }),
    fxaa: components.postProcessing.aa(),
  }),
  orbiter: components.orbiter({
    position: [0, 3, 8],
    element: ctx.gl.canvas,
  }),
});
world.add(cameraEntity);

// Meshes
const floorEntity = createEntity({
  transform: components.transform({
    position: [0, -0.3, 0],
  }),
  geometry: components.geometry(cube({ sx: 14, sy: 0.02, sz: 14 })),
  material: components.material({
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
world.add(floorEntity);

let instanced = true;
const geom = cube({ sx: 0.2, sy: 0.5 + random.float(), sz: 0.2 });
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
  const ent = createEntity({
    geometry: components.geometry(geom),
    transform: components.transform({}),
    material: components.material({
      baseColor: colors[0],
      rougness: 0.7,
      metallic: 0.0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  world.add(ent); //TODO
} else {
  offsets.forEach((offset, i) => {
    const ent = createEntity({
      geometry: components.geometry(geom),
      transform: components.transform({
        position: offset,
        scale: scales[i],
      }),
      material: components.material({
        baseColor: colors[i],
        rougness: 0.7,
        metallic: 0.0,
        castShadows: true,
        receiveShadows: true,
      }),
    });
    world.add(ent); //TODO:
  });
}

const sphereGeometry = sphere({ radius: 0.2 + random.float() * 0.25 });
for (let i = 0; i < 100; i++) {
  const x = (rand() * 8) / 3;
  const z = (rand() * 8) / 3;
  const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z);
  const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2);
  const ent = createEntity({
    geometry: components.geometry(sphereGeometry),
    transform: components.transform({
      position: [x, y, z],
      scale: [s, s, s],
    }),
    material: components.material({
      baseColor: gradient(random.float()).concat(1),
      rougness: 0.91,
      metallic: 0.0,
      castShadows: true,
      receiveShadows: true,
    }),
  });
  world.add(ent); //TODO:
}

// Lights
const sunPosition = [1, 2, 3];

const sunLight = components.directionalLight({
  color: [1, 1, 1, 2],
  intensity: 2, //TODO: not working light intensity
  castShadows: true,
  bias: 0.1,
});

const sunTransform = components.transform({
  position: sunPosition,
  rotation: quat.fromDirection(
    quat.create(),
    vec3.normalize(vec3.sub([0, 0, 0], sunPosition)),
  ),
});
const sunEntity = createEntity({
  transform: sunTransform,
  directionalLight: sunLight,
});
world.add(sunEntity);

const skyboxCmp = components.skybox({
  sunPosition,
});
const reflectionProbeCmp = components.reflectionProbe();
const skyEntity = createEntity({
  skybox: skyboxCmp,
  reflectionProbe: reflectionProbeCmp,
});
world.add(skyEntity);

const pointLightEntity = createEntity({
  transform: components.transform({
    position: [2, 2, 2],
  }),
  // geometry: components.geometry(sphere({ radius: 0.2 })),
  material: components.material({
    baseColor: [1, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1],
  }),
  pointLight: components.pointLight({
    // castShadows: true,
    color: [1, 0, 0, 1],
    intensity: 5,
  }),
});
// world.add(pointLightEntity);

const areaLightColor = [0, 1, 0, 1];
const areaLightEntity = createEntity({
  transform: components.transform({
    position: [5, 2, 0],
    scale: [2, 5, 0.1],
    rotation: quat.fromDirection(quat.create(), [-1, 1, 0]),
  }),
  // geometry: components.geometry(cube({ sx: 1 })),
  material: components.material({
    emissiveColor: areaLightColor,
    baseColor: [0, 0, 0, 1],
    metallic: 1.0,
    roughness: 0.74,
  }),
  areaLight: components.areaLight({
    intensity: 5,
    color: areaLightColor,
  }),
});
// world.add(areaLightEntity);

// GUI
gui.addParam(
  "AreaLight Size",
  areaLightEntity.transform,
  "scale",
  { min: 0, max: 5 },
  (value) => {
    areaLightEntity.transform.set({ scale: [value[0], value[1], value[2]] });
  },
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
  updateSunPosition,
);

updateSunPosition();

window.addEventListener("keydown", ({ key }) => {
  if (key === "d") debugOnce = true;
});

const geometrySystem = systems.geometry({ ctx });
const transformSystem = systems.transform();
const cameraSystem = systems.camera();
const skyboxSystem = systems.skybox({ ctx, resourceCache });
const reflectionProbeSystem = systems.reflectionProbe({ ctx, resourceCache });
const lightSystem = systems.light();
const renderPipelineSystem = systems.renderPipeline({
  ctx,
  resourceCache,
  renderGraph,
});
const standardRendererSystem = systems.renderer.standard({
  ctx,
  resourceCache,
  renderGraph,
});
const skyboxRendererSystem = systems.renderer.skybox({ ctx, resourceCache });

let shadowMapPreview;

ctx.frame(() => {
  resourceCache.beginFrame();
  renderGraph.beginFrame();

  const renderView = {
    camera: cameraEntity.camera,
    cameraEntity: cameraEntity,
    viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
  };

  try {
    geometrySystem.update(world.entities);
    transformSystem.update(world.entities);
    skyboxSystem.update(world.entities);
    cameraSystem.update(world.entities);
    reflectionProbeSystem.update(world.entities, {
      renderers: [skyboxRendererSystem],
    });
    lightSystem.update(world.entities);
    renderPipelineSystem.update(world.entities, {
      renderers: [standardRendererSystem, skyboxRendererSystem],
      renderView,
    });
  } catch (error) {
    console.error(error);
    return false;
  }

  renderGraph.endFrame();
  resourceCache.endFrame();

  if (sunLight._shadowMap && !shadowMapPreview) {
    shadowMapPreview = gui.addTexture2D("Shadow Map", sunLight._shadowMap); //TODO
  }

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
