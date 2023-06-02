import {
  world as createWorld,
  entity as createEntity,
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
  components,
} from "../index.js";

import createContext from "pex-context";
import { quat } from "pex-math";
import createGUI from "pex-gui";

import { cube, torus, sphere } from "primitive-geometry";

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
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

// Entities
const cameraEntity = createEntity({
  transform: transform({ position: [0, 0, 3] }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  orbiter: orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const cubeEntity = createEntity({
  transform: transform({ position: [0, -1, 0] }),
  geometry: geometry(cube({ sx: 10, sy: 0.1, sz: 10 })),
  material: material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(cubeEntity);

const torusEntity = createEntity({
  transform: transform(),
  geometry: geometry(torus({ radius: 1 })),
  material: material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(torusEntity);

const sphereEntity = createEntity({
  transform: transform({ position: [0, 0, 0] }),
  geometry: geometry(sphere({ radius: 1 })),
  material: material({
    baseColor: [1, 1, 1, 1],
    metallic: 1,
    roughness: 0.1,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(sphereEntity);

const skyEntity = createEntity({
  skybox: skybox({ sunPosition: [0, 5, -5] }),
  reflectionProbe: reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: transform({
    position: [0, 2, 0],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [0, 1, 0]),
  }),
  directionalLight: directionalLight({ color: [1, 0, 0, 1], intensity: 10 }),
});
world.add(directionalLightEntity);

// Systems
const geometrySystem = systems.geometry({ ctx });
const transformSystem = systems.transform();
const cameraSystem = systems.camera();
const skyboxSystem = systems.skybox({ ctx });
const reflectionProbeSystem = systems.reflectionProbe({ ctx });
const renderPipelineSystem = systems.renderPipeline({
  ctx,
  resourceCache,
  renderGraph,
  outputEncoding: ctx.Encoding.Linear,
});
const standardRendererSystem = systems.renderer.standard({
  ctx,
  resourceCache,
  renderGraph,
});
const skyboxRendererSystem = systems.renderer.skybox({ ctx });

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();

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
  const now = Date.now() * 0.0005;
  quat.fromAxisAngle(torusEntity.transform.rotation, [1, 0, 0], now * 2);
  torusEntity.transform.dirty = true; //UGH

  skyEntity.skybox.sunPosition = [
    Math.cos(now),
    (Math.sin(now) + 1) * 0.5,
    Math.sin(now),
  ];

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
    reflectionProbeSystem.update(world.entities, {
      renderers: [skyboxRendererSystem],
    });
    cameraSystem.update(world.entities);
    renderPipelineSystem.update(world.entities, {
      renderers: [standardRendererSystem, skyboxRendererSystem],
      renderView: renderView,
    });
  } catch (e) {
    console.error(e);
    return false;
  }

  renderGraph.endFrame();
  resourceCache.endFrame();

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
