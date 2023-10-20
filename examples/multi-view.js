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
import { aabb } from "pex-geom";
import createGUI from "pex-gui";
import { create, fromHSL } from "pex-color";
import random from "pex-random";

import { cube, sphere } from "primitive-geometry";

import { debugSceneTree } from "./utils.js";

import dot from "./graph-viz.js";

random.seed(0);

const pixelRatio = devicePixelRatio;
const ctx = createContext({ pixelRatio });
const world = createWorld();
const renderGraph = createRenderGraph(ctx);
const resourceCache = createResourceCache(ctx);

const oldApply = ctx.apply;
ctx.apply = (...args) => {
  // const rt =
  // ctx.stack[ctx.stack.length - 1].pass?.framebuffer.color?.[0].texture;
  const cmd = args[0];
  const fbo = cmd.pass?.framebuffer;
  const rt = fbo?.color?.[0].texture; //?.framebuffer?.color?.[0];
  const dt = fbo?.depth?.texture;

  const parentFBO = ctx.stack[ctx.stack.length - 1].pass?.framebuffer;
  const rtName =
    parentFBO != fbo ? (rt?.name || rt?.id || "").replace("\n", " - ") : "";
  const dtName =
    parentFBO != fbo ? (dt?.name || dt?.id || "").replace("\n", " - ") : "";

  const inputTextures = [
    cmd.uniforms?.["uDirectionalLightShadowMaps[0]"],
    cmd.uniforms?.["uDirectionalLightShadowMaps[1]"],
  ]
    .filter((_) => _)
    .map((tex) => tex.id);

  if (ctx.debugMode)
    console.log(
      "capture commands",
      args,
      "  ".repeat(ctx.stack.length),
      cmd.name,
      rtName ? "-> [" + [rtName, dtName].join(" | ") + "]" : " ",
      inputTextures ? "<- [" + inputTextures.join(" | ") + "]" : " "
    );
  oldApply.call(ctx, ...args);
};

const entities = (window.entities = []);
renderGraph.renderPass = (opts) => {
  if (dot) {
    const passId =
      opts.pass?.id || "RenderPass " + renderGraph.renderPasses.length;
    const passName = opts.name || opts.pass?.name || null;

    dot.passNode(passId, passName.replace(" ", "\n"));

    const colorTextureId = opts?.pass?.opts?.color?.[0].id;
    const colorTextureName = opts?.pass?.opts?.color?.[0].name;
    if (colorTextureId) {
      dot.resourceNode(colorTextureId, colorTextureName.replace(" ", "\n"));
      dot.edge(passId, colorTextureId);
    } else {
      dot.edge(passId, "Window");
    }

    const depthTextureId = opts?.pass?.opts?.depth?.id;
    const depthTextureName = opts?.pass?.opts?.depth?.name;
    if (depthTextureId) {
      dot.resourceNode(depthTextureId, depthTextureName.replace(" ", "\n"));
      dot.edge(passId, depthTextureId);
    }
    if (opts.uses) {
      opts.uses.forEach((tex) => {
        if (dot) dot.edge(tex.id, passId);
      });
    }
  }

  if (opts.uses && ctx.debugMode) console.log("render-graph uses", opts.uses);

  renderGraph.renderPasses.push(opts);
};

// Entities
const postProcessing = components.postProcessing({
  aa: components.postProcessing.aa(),
  dof: components.postProcessing.dof({
    focusDistance: 3,
  }),
});
const cameraEntity = createEntity({
  transform: components.transform({ position: [0, 3, 3] }),
  camera: components.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    target: [0, 1, 0],
    clearColor: [0.03, 0.03, 0.03, 1],
    fStop: 0.1,
  }),
  postProcessing,
  orbiter: components.orbiter({ element: ctx.gl.canvas }),
});
world.add(cameraEntity);

// const cameraBasicEntity = createEntity({
//   transform: components.transform({ position: [0, 3, 3] }),
//   camera: components.camera({
//     fov: Math.PI / 2,
//     aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
//     target: [0, 1, 0],
//     clearColor: [0.1, 0.1, 0.1, 1],
//   }),
//   postProcessing,
//   orbiter: components.orbiter({ element: ctx.gl.canvas }),
// });
// world.add(cameraBasicEntity);

const floorEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry(cube({ sx: 3, sy: 0.1, sz: 3 })),
  material: components.material({
    baseColor: [1, 0.8, 0.2, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(floorEntity);

const CUBE_INSTANCES = 64;

const cubesEntity = createEntity({
  transform: components.transform({
    position: [0, 1, 0],
  }),
  geometry: components.geometry({
    ...cube({ sx: 1.5, sy: 0.5, sz: 1.5 }),
    offsets: new Float32Array(CUBE_INSTANCES * 3).map(() =>
      random.float(-1.5, 1.5)
    ),
    scales: new Float32Array(CUBE_INSTANCES * 3).fill(0.1),
    rotations: new Float32Array(
      Array.from({ length: CUBE_INSTANCES }, () => random.quat()).flat()
    ),
    colors: new Float32Array(CUBE_INSTANCES * 4).map((_, i) =>
      i % 4 === 3 ? 1 : random.float()
    ),
    instances: CUBE_INSTANCES,
  }),
  material: components.material({
    baseColor: [1, 1, 1, 0.5],
    castShadows: true,
    receiveShadows: true,
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.One,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(cubesEntity);

const spinningEntity = createEntity({
  transform: components.transform({
    position: [0, 1, 0],
  }),
  geometry: components.geometry(cube()),
  material: components.material({
    baseColor: [0.5, 0.5, 0.5, 1],
    metallic: 0,
    roughness: 0.5,
    castShadows: true,
    receiveShadows: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper({
    color: [0, 0, 1, 1],
  }),
});
world.add(spinningEntity);

const linePositions = [];
const lineVertexColors = [];
const lineThickness = 20;
for (let i = 0; i < 10; i++) {
  linePositions.push(random.vec3(3), random.vec3(3));
  const c = fromHSL(create(), random.float(), 0.5, 0.5, lineThickness);
  lineVertexColors.push(c, c);
}

const linesEntity = createEntity({
  transform: components.transform(),
  geometry: components.geometry({
    positions: linePositions,
    vertexColors: lineVertexColors,
    count: linePositions.length / 2,
  }),
  material: components.material({
    type: "line",
    baseColor: [1, 1, 1, 1],
    castShadows: true,
    lineWidth: 10,
    lineResolution: 16,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(linesEntity);

const sphereEntity = createEntity({
  transform: components.transform({
    position: [0, 2, 0],
  }),
  geometry: components.geometry(sphere()),
  material: components.material({
    baseColor: [1, 0, 1, 1],
    metallic: 0,
    roughness: 0.5,
    castShadows: true,
    receiveShadows: true,
    // transmission: 0.5,
    // blend: true,
    // blendSrcRGBFactor: ctx.BlendFactor.One,
    // blendSrcAlphaFactor: ctx.BlendFactor.One,
    // blendDstRGBFactor: ctx.BlendFactor.Zero,
    // blendDstAlphaFactor: ctx.BlendFactor.Zero,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
world.add(sphereEntity);

// TODO: is it needed?
floorEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  floorEntity.geometry.positions
);
spinningEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  spinningEntity.geometry.positions
);

const skyboxEntity = createEntity({
  skybox: components.skybox({
    sunPosition: [0.1, 0.04, -1],
  }),
  reflectionProbe: components.reflectionProbe(),
});
world.add(skyboxEntity);

const directionalLightEntity = createEntity({
  transform: components.transform({
    position: [2, 2, 0],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  directionalLight: components.directionalLight({
    color: [1, 0.1, 0.1, 1], //FIXME: intensity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
    shadowMapSize: 1024,
  }),
  lightHelper: components.lightHelper(),
});
world.add(directionalLightEntity);

const directionalLightEntity2 = createEntity({
  transform: components.transform({
    position: [-2, 2, 0],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [-1, -1, 0]),
  }),
  directionalLight: components.directionalLight({
    color: [0.1, 0.1, 1.0, 1], //FIXME: intensity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
  }),
  lightHelper: components.lightHelper(),
});
world.add(directionalLightEntity2);

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
  outputEncoding: ctx.Encoding.Linear,
});
const standardRendererSystem = systems.renderer.standard({
  ctx,
  resourceCache,
  renderGraph,
});
const basicRendererSystem = systems.renderer.basic({
  ctx,
  resourceCache,
  renderGraph,
});
const lineRendererSystem = systems.renderer.line({
  ctx,
  resourceCache,
  renderGraph,
});
const skyboxRendererSystem = systems.renderer.skybox({
  ctx,
  resourceCache,
  renderGraph,
});
const helperRendererSystem = systems.renderer.helper({ ctx });
const postProcessingRendererSystem = systems.renderer.postProcessing({
  ctx,
  resourceCache,
});

const createView = (cameraEntity, viewport) => ({
  viewport,
  cameraEntity,
  draw(cb) {
    const W = ctx.gl.drawingBufferWidth;
    const H = ctx.gl.drawingBufferHeight;
    const renderView = {
      viewport: [
        viewport[0] * W,
        viewport[1] * H,
        viewport[2] * W,
        viewport[3] * H,
      ],
      cameraEntity,
      camera: cameraEntity.camera,
      toneMap: cameraEntity.camera.toneMap,
    };
    cameraEntity.camera.aspect =
      renderView.viewport[2] / renderView.viewport[3];
    cameraEntity.camera.dirty = true;
    cameraSystem.update(world.entities);

    cb(renderView, viewport);
  },
});

const view1 = createView(cameraEntity, [0.0, 0.0, 0.5, 1]);
const view2 = createView(cameraEntity, [0.5, 0.0, 0.5, 1]);

let frame = 0;

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addStats();
gui.addButton("Tree", () => {
  debugSceneTree(entities);
});
const guiColorControl = gui.addTexture2D("Color", null, { flipY: true });
// const guiNormalControl = gui.addTexture2D("Normal", null, { flipY: true });
const guiDepthControl = gui.addTexture2D("Depth", null, { flipY: true });

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.set({ pixelRatio, width, height });
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  frame++;

  dot.reset();

  // skyboxEntity.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  quat.fromAxisAngle(
    spinningEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  spinningEntity.transform.dirty = true;

  resourceCache.beginFrame();
  renderGraph.beginFrame();
  // can't just automatically render all the systems as we have two views
  // world.update();

  geometrySystem.update(world.entities);
  transformSystem.update(world.entities);
  skyboxSystem.update(world.entities);

  reflectionProbeSystem.update(world.entities, {
    renderers: [skyboxRendererSystem],
  });
  lightSystem.update(world.entities);

  view1.draw((renderView) => {
    renderPipelineSystem.update(world.entities, {
      renderers: [
        standardRendererSystem,
        lineRendererSystem,
        skyboxRendererSystem,
        postProcessingRendererSystem,
      ],
      renderView: renderView,
    });
  });

  view2.draw((renderView) => {
    const { color, normal, depth } = renderPipelineSystem.update(
      world.entities,
      {
        renderers: [
          basicRendererSystem,
          lineRendererSystem,
          helperRendererSystem,
          postProcessingRendererSystem,
        ],
        renderView: renderView,
      }
    );
    guiColorControl.texture = color;
    // guiNormalControl.texture = normal;
    guiDepthControl.texture = depth;
  });

  renderGraph.endFrame();
  resourceCache.endFrame();

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  if (frame == 1) dot.render();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
