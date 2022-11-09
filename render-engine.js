import createAnimationSystem from "./systems/animation.js";
import createCameraSystem from "./systems/camera.js";
import createGeometrySystem from "./systems/geometry.js";
import createReflectionProbeSystem from "./systems/reflection-probe.js";
import createRenderPipelineSystem from "./systems/render-pipeline.js";
import createSkyboxSystem from "./systems/skybox.js";
import createTransformSystem from "./systems/transform.js";

import createHelperRenderer from "./systems/renderer/helper.js";
import createLineRenderer from "./systems/renderer/line.js";
import createStandardRenderer from "./systems/renderer/standard.js";
import createSkyboxRenderer from "./systems/renderer/skybox.js";

import createRenderGraph from "./render-graph.js";
import createResourceCache from "./resource-cache.js";

const systems = {
  renderer: {
    helper: createHelperRenderer,
    line: createLineRenderer,
    standard: createStandardRenderer,
    skybox: createSkyboxRenderer,
  },
  animation: createAnimationSystem,
  camera: createCameraSystem,
  geometry: createGeometrySystem,
  reflectionProbe: createReflectionProbeSystem,
  renderPipeline: createRenderPipelineSystem,
  skybox: createSkyboxSystem,
  transform: createTransformSystem,
};

export default function defaultEngine(opts) {
  const { ctx } = opts;

  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const animationSys = systems.animation();
  const geometrySys = systems.geometry({ ctx });
  const transformSys = systems.transform();
  const cameraSys = systems.camera();
  const skyboxSys = systems.skybox({ ctx });
  const reflectionProbeSys = systems.reflectionProbe({ ctx });
  const renderPipelineSys = systems.renderPipeline({
    ctx,
    resourceCache,
    renderGraph,
    outputEncoding: ctx.Encoding.Linear,
    shadowQuality: 3,
  });

  const standardRendererSystem = systems.renderer.standard({
    ctx,
    resourceCache,
    renderGraph,
  });
  const lineRendererSystem = systems.renderer.line({
    ctx,
    resourceCache,
    renderGraph,
  });
  const helperRendererSys = systems.renderer.helper({ ctx });
  const skyboxRendererSys = systems.renderer.skybox({ ctx });

  const renderEngine = {
    systems: [
      animationSys,
      geometrySys,
      transformSys,
      skyboxSys,
      cameraSys,
      renderPipelineSys,
    ],
    renderers: [
      standardRendererSystem,
      lineRendererSystem,
      skyboxRendererSys,
      helperRendererSys,
    ],
    update: (entities, deltaTime) => {
      animationSys.update(entities, deltaTime);
      geometrySys.update(entities);
      transformSys.update(entities);
      skyboxSys.update(entities);
      cameraSys.update(entities);
    },
    render: (entities, cameraEntity, options = {}) => {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      reflectionProbeSys.update(entities, {
        renderers: [skyboxRendererSys],
      });

      const renderView = {
        camera: cameraEntity.camera,
        cameraEntity: cameraEntity,
        viewport: [
          0,
          0,
          options.width || ctx.gl.drawingBufferWidth,
          options.height || ctx.gl.drawingBufferHeight,
        ],
      };

      const framebufferTextures = renderPipelineSys.update(entities, {
        renderers: options.renderers || renderEngine.renderers,
        renderView: options.renderView || renderView,
        drawToScreen: options.drawToScreen,
      });

      renderGraph.endFrame();
      resourceCache.endFrame();

      return framebufferTextures;
    },
  };
  return renderEngine;
}
