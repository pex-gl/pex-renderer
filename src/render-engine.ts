import * as systems from "./systems/index.js";

import createRenderGraph from "./render-graph.js";
import createResourceCache from "./resource-cache.js";
import { getDefaultViewport } from "./utils.js";

import type {
  Entity,
  GpuContext,
  RenderEngineOptions,
  RenderView,
  System,
  SystemOptions,
} from "./types.js";

export default ({
  ctx,
  debug = false,
}: {
  ctx: GpuContext;
  debug?: boolean;
}) => {
  const renderGraph = createRenderGraph(ctx);
  const resourceCache = createResourceCache(ctx);

  const options: SystemOptions = { ctx, resourceCache, renderGraph };

  const animationSystem = systems.animation();
  const skinSystem = systems.skin();
  const geometrySystem = systems.geometry(options);
  const morphSystem = systems.morph();
  const transformSystem = systems.transform();
  const layerSystem = systems.layer();
  const skyboxSystem = systems.skybox(options);
  const cameraSystem = systems.camera();

  const lightSystem = systems.light();
  const renderPipelineSystem = systems.renderPipeline(options);

  const standardRendererSystem = systems.renderer.standard(options);
  const skyboxRendererSystem = systems.renderer.skybox(options);

  const renderEngine = {
    debug(enabled: boolean) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.debug = enabled;
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i]!.debug = enabled;
      }
      this.debugMode = enabled;
    },
    debugMode: false,
    time: 0,
    deltaTime: 0,
    _prevTime: performance.now(),
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

      lightSystem,
      renderPipelineSystem,
    ] as System[],
    renderers: [standardRendererSystem, skyboxRendererSystem],
    update(entities: Entity[], deltaTime?: number) {
      const now = performance.now();
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
        this.renderers[i]!.update(entities, this);
      }
    },
    render(
      entities: Entity[],
      cameraEntities: Entity | Entity[],
      options: RenderEngineOptions = {},
    ) {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      const cameras = Array.isArray(cameraEntities)
        ? cameraEntities
        : [cameraEntities];

      const framebufferTexturesPerCamera = cameras.map((cameraEntity) => {
        const camera = cameraEntity.camera!;

        // Set render view
        const viewport = camera.viewport || getDefaultViewport(ctx);

        const aspect = viewport[2]! / viewport[3]!;

        if (aspect !== camera.aspect) {
          camera.aspect = aspect;
          camera.dirty = true;
        }

        const renderView: RenderView = {
          camera,
          cameraEntity,
          viewport,
        };

        const entitiesForCamera = cameraEntity.layer
          ? entities.filter(
              (entity) => !entity.layer || entity.layer == cameraEntity.layer,
            )
          : entities;

        // Update camera dependent systems
        const updateOptions = {
          time: options.time ?? this.time,
          renderers: options.renderers || this.renderers,
          renderView,
          drawToScreen: options.drawToScreen,
          renderEngine: this,
        };

        lightSystem.update(entitiesForCamera);

        const framebufferTextures = renderPipelineSystem.update(
          entitiesForCamera,
          updateOptions,
        );
        return framebufferTextures;
      });

      renderGraph.endFrame();
      resourceCache.endFrame();

      return framebufferTexturesPerCamera;
    },
    dispose(entities?: Entity[]) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.dispose?.(entities);
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i]!.dispose?.(entities);
      }

      resourceCache.dispose();
    },
  };
  renderEngine.debug(debug);
  return renderEngine;
};
