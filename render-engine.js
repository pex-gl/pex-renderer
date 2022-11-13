import createAnimationSystem from "./systems/animation.js";
import createCameraSystem from "./systems/camera.js";
import createGeometrySystem from "./systems/geometry.js";
import createReflectionProbeSystem from "./systems/reflection-probe.js";
import createRenderPipelineSystem from "./systems/render-pipeline.js";
import createSkyboxSystem from "./systems/skybox.js";
import createTransformSystem from "./systems/transform.js";
import createLayerSystem from "./systems/layer.js";

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
  layer: createLayerSystem,
};

export default function defaultEngine(opts) {
  const { ctx } = opts;

  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const animationSys = systems.animation();
  const geometrySys = systems.geometry({ ctx });
  const transformSys = systems.transform();
  const layerSys = systems.layer();
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
      layerSys.update(entities);
      skyboxSys.update(entities);
      cameraSys.update(entities);
    },
    render: (entities, cameraEntities, options = {}) => {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      if (!Array.isArray(cameraEntities)) {
        cameraEntities = [cameraEntities];
      }

      const framebufferTexturesPerCamera = [];
      cameraEntities.forEach((cameraEntity) => {
        const viewport = cameraEntity.camera.viewport || [
          0,
          0,
          options.width || ctx.gl.drawingBufferWidth,
          options.height || ctx.gl.drawingBufferHeight,
        ];

        cameraEntity.camera.aspect = viewport[2] / viewport[3];
        cameraEntity.camera.dirty = true;

        const renderView = {
          camera: cameraEntity.camera,
          cameraEntity: cameraEntity,
          viewport: viewport,
        };

        const entitiesForCamera = cameraEntity.layer
          ? entities.filter((e) => !e.layer || e.layer == cameraEntity.layer)
          : entities;

        reflectionProbeSys.update(entitiesForCamera, {
          renderers: [skyboxRendererSys],
        });

        const framebufferTextures = renderPipelineSys.update(
          entitiesForCamera,
          {
            renderers: options.renderers || renderEngine.renderers,
            renderView: renderView,
            drawToScreen: options.drawToScreen,
          }
        );
        framebufferTexturesPerCamera.push(framebufferTextures);
      });

      renderGraph.endFrame();
      resourceCache.endFrame();

      return framebufferTexturesPerCamera.length
        ? framebufferTexturesPerCamera
        : framebufferTexturesPerCamera[0];
    },
  };
  return renderEngine;
}
