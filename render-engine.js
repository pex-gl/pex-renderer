import * as systems from "./systems/index.js";

import createRenderGraph from "./render-graph.js";
import createResourceCache from "./resource-cache.js";

export default ({ ctx, debug = false }) => {
  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const animationSystem = systems.animation();
  const skinSystem = systems.skin();
  const geometrySystem = systems.geometry({ ctx });
  const morphSystem = systems.morph();
  const transformSystem = systems.transform();
  const layerSystem = systems.layer();
  const skyboxSystem = systems.skybox({ ctx, resourceCache });
  const cameraSystem = systems.camera();

  const reflectionProbeSystem = systems.reflectionProbe({ ctx, resourceCache });
  const lightSystem = systems.light();
  const renderPipelineSystem = systems.renderPipeline({
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
  const skyboxRendererSystem = systems.renderer.skybox({ ctx, resourceCache });
  const helperRendererSystem = systems.renderer.helper({ ctx });

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
    renderGraph,
    resourceCache,
    systems: [
      animationSystem,
      skinSystem,
      geometrySystem,
      morphSystem,
      transformSystem,
      layerSystem,
      skyboxSystem,
      cameraSystem,

      reflectionProbeSystem,
      lightSystem,
      renderPipelineSystem,
    ],
    renderers: [
      standardRendererSystem,
      lineRendererSystem,
      skyboxRendererSystem,
      helperRendererSystem,
    ],
    update: (entities, deltaTime) => {
      animationSystem.update(entities, deltaTime);
      skinSystem.update(entities);
      geometrySystem.update(entities);
      morphSystem.update(entities);
      transformSystem.update(entities);
      layerSystem.update(entities);
      skyboxSystem.update(entities);
      cameraSystem.update(entities);
    },
    render: (entities, cameraEntities, options = {}) => {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      if (!Array.isArray(cameraEntities)) cameraEntities = [cameraEntities];

      const framebufferTexturesPerCamera = cameraEntities.map(
        (cameraEntity) => {
          // Set render view
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
            cameraEntity,
            viewport,
          };

          const entitiesForCamera = cameraEntity.layer
            ? entities.filter(
                (entity) => !entity.layer || entity.layer == cameraEntity.layer
              )
            : entities;

          // Update camera dependent systems
          reflectionProbeSystem.update(entitiesForCamera, {
            renderers: [skyboxRendererSystem],
          });
          lightSystem.update(entitiesForCamera);

          const framebufferTextures = renderPipelineSystem.update(
            entitiesForCamera,
            {
              renderers: options.renderers || renderEngine.renderers,
              renderView,
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
    dispose() {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].dispose?.();
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].dispose?.();
      }

      resourceCache.dispose();
    },
  };
  renderEngine.debug(debug);
  return renderEngine;
};
