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

import { updateSunPosition } from "./utils.js";

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const world = createWorld();
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

// Entities
const cameraEntity = createEntity({
  transform: components.transform({ position: [3, 3, 3] }),
  camera: components.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  }),
  postProcessing: components.postProcessing(),
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

const cubeEntity = createEntity({
  transform: components.transform({ position: [0, -1, 0] }),
  geometry: components.geometry(cube({ sx: 10, sy: 0.1, sz: 10 })),
  material: components.material({
    baseColor: [0.7, 0.7, 0, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(cubeEntity);

const torusEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(torus({ radius: 1 })),
  material: components.material({
    baseColor: [0, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(torusEntity);

const sphereEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(sphere({ radius: 1 })),
  material: components.material({
    baseColor: [1, 1, 1, 1],
    metallic: 1,
    roughness: 0.1,
    castShadows: true,
    receiveShadows: true,
  }),
});
world.add(sphereEntity);

const skyEntity = createEntity({
  skybox: components.skybox({ sunPosition: [0, 0.05, -1] }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [0, 2, 0],
    rotation: quat.fromDirection(quat.create(), [0, -1, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 0, 0, 1],
    intensity: 10,
  }),
});
world.add(directionalLightEntity);

// Systems
const geometrySystem = systems.geometry({ ctx });
const transformSystem = systems.transform();
const skyboxSystem = systems.skybox({ ctx, resourceCache });
const cameraSystem = systems.camera();
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
  const now = performance.now() * 0.001;
  quat.fromAxisAngle(torusEntity.transform.rotation, [1, 0, 0], now);
  torusEntity.transform.dirty = true;

  const progress = (now / 3) % 1;
  updateSunPosition(
    skyEntity.skybox,
    30 * Math.sin(Math.PI * progress),
    360 * progress - 180,
  );

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

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("screenshot"));
});
