import { beginFrame, endFrame } from "pex-gpu";
import { commandsState } from "pex-gpu/internals";

import * as systems from "./systems/index.js";

import FrameGraph from "./frame-graph/index.js";
import { getDefaultViewport, mapValues } from "./utils.js";

import type {
  Entity,
  GpuContext,
  GpuTexture,
  RenderEngineOptions,
  RenderView,
  System,
  SystemOptions,
} from "./types.js";
import type { ResourceHandle } from "./frame-graph/index.js";

export default ({
  ctx,
  debug = false,
}: {
  ctx: GpuContext;
  debug?: boolean;
}) => {
  const frameGraph = new FrameGraph(ctx);

  const options: SystemOptions = { ctx, frameGraph };

  const animationSystem = systems.animation();
  const skinSystem = systems.skin();
  const geometrySystem = systems.geometry(options);
  const morphSystem = systems.morph();
  const transformSystem = systems.transform();
  const layerSystem = systems.layer();
  const skyboxSystem = systems.skybox(options);
  const cameraSystem = systems.camera();
  const helperSystem = systems.helper();

  const reflectionProbeSystem = systems.reflectionProbe(options);
  const lightSystem = systems.light();
  const renderPipelineSystem = systems.renderPipeline(options);

  const standardRendererSystem = systems.renderer.standard(options);
  const lineRendererSystem = systems.renderer.line(options);
  const skyboxRendererSystem = systems.renderer.skybox(options);

  const renderEngine = {
    debug(enabled: boolean) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.debug = enabled;
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i]!.debug = enabled;
      }
      frameGraph.debug = enabled;
      this.debugMode = enabled;
    },
    debugMode: false,
    time: 0,
    deltaTime: 0,
    _prevTime: performance.now(),
    frameGraph,
    systems: [
      animationSystem,
      skinSystem,
      geometrySystem,
      morphSystem,
      transformSystem,
      layerSystem,
      skyboxSystem,
      cameraSystem,
      helperSystem,

      reflectionProbeSystem,
      lightSystem,
      renderPipelineSystem,
    ] as System[],
    renderers: [
      standardRendererSystem,
      lineRendererSystem,
      skyboxRendererSystem,
    ],
    /**
     * CPU-side scene update, plus the GPU work that produces inputs for the
     * frame rather than the frame itself (sky and reflection probe bakes).
     *
     * Brackets its own command buffer so those bakes batch into one submit,
     * unless the caller already opened one.
     */
    update(entities: Entity[], deltaTime?: number) {
      const now = performance.now();
      this.deltaTime = deltaTime || (now - this._prevTime) / 1000;
      this._prevTime = now;
      this.time += this.deltaTime;

      const ownsSegment = !commandsState(ctx).frame;
      if (ownsSegment) beginFrame(ctx);
      try {
        animationSystem.update(entities, this);
        skinSystem.update(entities);
        geometrySystem.update(entities);
        morphSystem.update(entities);
        transformSystem.update(entities);
        layerSystem.update(entities);
        skyboxSystem.update(entities);
        reflectionProbeSystem.update(entities);
        cameraSystem.update(entities);

        for (let i = 0; i < this.renderers.length; i++) {
          this.renderers[i]!.update(entities, this);
        }
      } finally {
        if (ownsSegment) endFrame(ctx);
      }
    },
    /**
     * Declare, compile and execute one frame.
     *
     * Async because `stage()` hooks may be. Call it from an async `gpu.frame`
     * callback: that keeps one segment open across the whole tick, so this and
     * everything drawn after it — GUI included — share a command buffer. What
     * it awaits must never yield long enough for the browser to present, which
     * destroys the swapchain texture the open segment holds and fails the
     * submit for the entire frame.
     *
     * All cameras share one graph, so a target finished by the first camera can
     * back a different one for the second: peak memory tracks the heaviest
     * camera rather than their sum.
     */
    async render(
      entities: Entity[],
      cameraEntities: Entity | Entity[],
      options: RenderEngineOptions = {},
    ) {
      const cameras = Array.isArray(cameraEntities)
        ? cameraEntities
        : [cameraEntities];

      let targetHandlesPerCamera: Record<string, ResourceHandle>[] = [];

      await frameGraph.render(async () => {
        targetHandlesPerCamera = [];

        for (const cameraEntity of cameras) {
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

          const { entities: helperEntities } = helperSystem.update(
            entitiesForCamera,
            updateOptions,
          );

          lightSystem.update(entitiesForCamera);

          targetHandlesPerCamera.push(
            await renderPipelineSystem.update(
              [...entitiesForCamera, ...helperEntities],
              updateOptions,
            ),
          );
        }
      });

      // Handles only become textures once the graph has allocated them.
      return targetHandlesPerCamera.map((handles) =>
        mapValues(handles, (handle) => frameGraph.resolve(handle) as GpuTexture),
      );
    },
    dispose(entities?: Entity[]) {
      for (let i = 0; i < this.systems.length; i++) {
        this.systems[i]!.dispose?.(entities);
      }
      for (let i = 0; i < this.renderers.length; i++) {
        this.renderers[i]!.dispose?.(entities);
      }

      frameGraph.dispose();
    },
  };
  renderEngine.debug(debug);
  return renderEngine;
};
