import * as systems from "./systems/index.js";

import createRenderGraph from "./render-graph.js";
import createResourceCache from "./resource-cache.js";

export default ({ ctx, debugMode }) => {
  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const animationSys = systems.animation();
  const skinSys = systems.skin();
  const geometrySys = systems.geometry({ ctx });
  const morphSys = systems.morph();
  const transformSys = systems.transform();
  const layerSys = systems.layer();
  const cameraSys = systems.camera();
  const skyboxSys = systems.skybox({ ctx, resourceCache });
  const reflectionProbeSys = systems.reflectionProbe({ ctx, resourceCache });
  const lightSystem = systems.light();
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
  const skyboxRendererSys = systems.renderer.skybox({ ctx, resourceCache });

  const renderEngine = {
    // debugMode,
    debug(enabled) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].debug = enabled;
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].debug = enabled;
      }
      this.debugMode = enabled;
    },
    systems: [
      animationSys,
      skinSys,
      geometrySys,
      morphSys,
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
      skinSys.update(entities);
      geometrySys.update(entities);
      morphSys.update(entities);
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

      const framebufferTexturesPerCamera = cameraEntities.map(
        (cameraEntity) => {
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

          lightSystem.update(entitiesForCamera);

          const framebufferTextures = renderPipelineSys.update(
            entitiesForCamera,
            {
              renderers: options.renderers || renderEngine.renderers,
              renderView: renderView,
              drawToScreen: options.drawToScreen,
            }
          );
          return framebufferTextures;
        }
      );

      renderGraph.endFrame();
      resourceCache.endFrame();

      return framebufferTexturesPerCamera;
    },
  };
  renderEngine.debug(debugMode);
  return renderEngine;
};
