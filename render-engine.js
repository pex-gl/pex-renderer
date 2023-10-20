import * as systems from "./systems/index.js";

import createRenderGraph from "./render-graph.js";
import createResourceCache from "./resource-cache.js";

export default ({ ctx, debug = false }) => {
  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const options = { ctx, resourceCache, renderGraph };

  const animationSystem = systems.animation();
  const skinSystem = systems.skin();
  const geometrySystem = systems.geometry(options);
  const morphSystem = systems.morph();
  const transformSystem = systems.transform();
  const layerSystem = systems.layer();
  const skyboxSystem = systems.skybox(options);
  const cameraSystem = systems.camera();

  const reflectionProbeSystem = systems.reflectionProbe(options);
  const lightSystem = systems.light();
  const renderPipelineSystem = systems.renderPipeline(options);

  const standardRendererSystem = systems.renderer.standard(options);
  const lineRendererSystem = systems.renderer.line(options);
  const skyboxRendererSystem = systems.renderer.skybox(options);
  const helperRendererSystem = systems.renderer.helper(options);
  const postProcessingRendererSystem = systems.renderer.postProcessing(options);

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
    time: 0,
    deltaTime: 0,
    _prevTime: Date.now(),
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
      postProcessingRendererSystem,
    ],
    update(entities, deltaTime) {
      const now = Date.now();
      this.deltaTime = deltaTime || (now - this._prevTime) / 1000;
      this._prevTime = now;
      this.time += this.deltaTime;

      animationSystem.update(entities, this);
      skinSystem.update(entities);
      geometrySystem.update(entities);
      morphSystem.update(entities);
      transformSystem.update(entities);
      layerSystem.update(entities);
      skyboxSystem.update(entities);
      cameraSystem.update(entities);

      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].update(entities, this);
      }
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
    dispose(entities) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i].dispose?.(entities);
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i].dispose?.(entities);
      }

      resourceCache.dispose();
    },
  };
  renderEngine.debug(debug);
  return renderEngine;
};
