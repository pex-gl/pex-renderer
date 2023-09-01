import {
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

const {
  camera,
  directionalLight,
  geometry,
  material,
  orbiter,
  skybox,
  reflectionProbe,
  transform,
  lightHelper,
} = components;

const ctx = createContext();

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
const renderGraph = createRenderGraph(ctx);
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
const resourceCache = createResourceCache(ctx);

const cameraEntity = createEntity({
  transform: transform({ position: [0, 3, 3] }),
  camera: camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    target: [0, 1, 0],
    position: [0, 2, 4],
    clearColor: [0.03, 0.03, 0.03, 1],
  }),
  orbiter: orbiter({ element: ctx.gl.canvas }),
});
entities.push(cameraEntity);

const floorEntity = createEntity({
  transform: transform(),
  geometry: geometry(cube({ sx: 3, sy: 0.1, sz: 3 })),
  material: material({
    baseColor: [1, 0.8, 0.2, 1],
    metallic: 0,
    roughness: 0.2,
    castShadows: true,
    receiveShadows: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
entities.push(floorEntity);

const CUBE_INSTANCES = 64;

const cubesEntity = createEntity({
  transform: transform({
    position: [0, 1, 0],
  }),
  geometry: geometry({
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
  material: material({
    // baseColor: [0.2, 0.5, 0.2, 0.5],
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
entities.push(cubesEntity);

const spinningEntity = createEntity({
  transform: transform({
    position: [0, 1, 0],
  }),
  geometry: geometry(cube()),
  material: material({
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
entities.push(spinningEntity);

const linePositions = [];
const lineVertexColors = [];
const lineThickness = 20;
for (let i = 0; i < 10; i++) {
  linePositions.push(random.vec3(3), random.vec3(3));
  const c = fromHSL(create(), random.float(), 0.5, 0.5, lineThickness);
  lineVertexColors.push(c, c);
}

const linesEntity = createEntity({
  transform: transform(),
  geometry: geometry({
    positions: linePositions,
    vertexColors: lineVertexColors,
    count: linePositions.length / 2,
  }),
  material: material({
    type: "segments",
    baseColor: [1, 1, 1, 1],
    castShadows: true,
  }),
  boundingBoxHelper: components.boundingBoxHelper(),
});
entities.push(linesEntity);

const sphereEntity = createEntity({
  transform: transform({
    position: [0, 2, 0],
  }),
  geometry: geometry(sphere()),
  material: material({
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
entities.push(sphereEntity);

floorEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  floorEntity.geometry.positions
);
spinningEntity.geometry.bounds = aabb.fromPoints(
  aabb.create(),
  spinningEntity.geometry.positions
);

const skyboxEnt = createEntity({
  skybox: skybox({
    sunPosition: [0.1, 0.04, -1],
  }),
  reflectionProbe: reflectionProbe(),
});
entities.push(skyboxEnt);

const directionalLightEntity = createEntity({
  transform: transform({
    position: [2, 2, 0],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [1, 1, 1]),
  }),
  directionalLight: directionalLight({
    color: [1, 0.1, 0.1, 1], //FIXME: intensity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
    shadowMapSize: 1024,
  }),
  lightHelper: lightHelper(),
});
entities.push(directionalLightEntity);

const directionalLightEntity2 = createEntity({
  transform: transform({
    position: [-2, 2, 0],
    rotation: quat.targetTo(quat.create(), [0, 0, 0], [-1, -1, 0]),
  }),
  directionalLight: directionalLight({
    color: [0.1, 0.1, 1.0, 1], //FIXME: intensity is copied to alpha in pex-renderer
    intensity: 1,
    castShadows: true,
  }),
  lightHelper: lightHelper(),
});
entities.push(directionalLightEntity2);

const geometrySys = systems.geometry({ ctx });
const transformSys = systems.transform();
const cameraSys = systems.camera();
const skyboxSys = systems.skybox({ ctx, resourceCache });
const lightSys = systems.light();
const reflectionProbeSys = systems.reflectionProbe({ ctx, resourceCache });
const renderPipelineSys = systems.renderPipeline({
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

function createView(cameraEntity, viewport) {
  const view = {
    viewport: viewport,
    cameraEntity: cameraEntity,
  };
  view.draw = function (cb) {
    const W = ctx.gl.drawingBufferWidth;
    const H = ctx.gl.drawingBufferHeight;
    const renderView = {
      viewport: [
        viewport[0] * W,
        viewport[1] * H,
        viewport[2] * W,
        viewport[3] * H,
      ],
      cameraEntity: cameraEntity,
      camera: cameraEntity.camera,
    };
    const aspect = renderView.viewport[2] / renderView.viewport[3];
    cameraEntity.camera.aspect = aspect;
    cameraEntity.camera.dirty = true;
    cameraSys.update(entities);

    cb(renderView, viewport);
  };
  return view;
}

const view1 = createView(cameraEntity, [0.0, 0.0, 0.5, 1]);
const view2 = createView(cameraEntity, [0.5, 0.0, 0.5, 1]);

let shadowMapPreview;

let frame = 0;

// GUI
const gui = createGUI(ctx);
gui.addFPSMeeter();
gui.addStats();
gui.addButton("Tree", () => {
  debugSceneTree(entities);
});

// Events
let debugOnce = false;

window.addEventListener("resize", () => {
  ctx.set({
    pixelRatio: 1.5,
    width: window.innerWidth,
    height: window.innerHeight,
  });
});

window.addEventListener("keydown", ({ key }) => {
  if (key === "g") gui.enabled = !gui.enabled;
  if (key === "d") debugOnce = true;
});

ctx.frame(() => {
  frame++;

  dot.reset();
  resourceCache.beginFrame();
  renderGraph.beginFrame();

  // skyboxEnt.skybox.sunPosition = [1 * Math.cos(now), 1, 1 * Math.sin(now)];
  quat.fromAxisAngle(
    spinningEntity.transform.rotation,
    [0, 1, 0],
    Date.now() / 1000
  );
  spinningEntity.transform.dirty = true; //UGH

  // can't just automatically render all the systems as we have two views
  // world.update();

  geometrySys.update(entities);
  transformSys.update(entities);
  skyboxSys.update(entities);
  reflectionProbeSys.update(entities, {
    renderers: [skyboxRendererSystem],
  });
  lightSys.update(entities);

  //draw left/bottom side
  view1.draw((renderView) => {
    renderPipelineSys.update(entities, {
      renderers: [
        standardRendererSystem,
        lineRendererSystem,
        skyboxRendererSystem,
      ],
      renderView: renderView,
    });
  });

  //draw right/top side
  view2.draw((renderView) => {
    renderPipelineSys.update(entities, {
      renderers: [
        basicRendererSystem,
        lineRendererSystem,
        helperRendererSystem,
      ],
      renderView: renderView,
    });
  });

  if (frame == 1) dot.render();

  if (directionalLightEntity.directionalLight._shadowMap && !shadowMapPreview) {
    //TODO: mutated texture to flip in GUI
    directionalLightEntity.directionalLight._shadowMap.flipY = true;
    shadowMapPreview = gui.addTexture2D(
      "Shadow Map " + directionalLightEntity.directionalLight._shadowMap.id,
      directionalLightEntity.directionalLight._shadowMap,
      { flipY: true }
    ); //TODO
  }

  // const drawCmd = {
  //   pass: resourceCache.pass(passDesc),
  //   pipeline: resourceCache.pipeline(pipelineDesc),
  //   uniforms: {
  //     uViewportSize: [ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
  //   },
  // };
  // const fullscreenTriangle = resourceCache.fullscreenTriangle();
  // drawCmd.attributes = fullscreenTriangle.attributes;
  // drawCmd.count = fullscreenTriangle.count;
  // ctx.submit(drawCmd);

  renderGraph.endFrame();
  resourceCache.endFrame();

  ctx.debug(debugOnce);
  debugOnce = false;

  gui.draw();

  window.dispatchEvent(new CustomEvent("pex-screenshot"));
});
