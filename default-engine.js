import {
  renderGraph as createRenderGraph,
  resourceCache as createResourceCache,
  systems,
} from "../index.js"; //FIXME: umm doesn't that create cyclic dependency?

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
  });
  world.addSystem(renderPipelineSys);

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

  const engine = {
    transformSystem: transformSys, //FIXME: code smell
    update: (entities, deltaTime) => {
      animationSys.update(entities, deltaTime);
      geometrySys.update(entities);
      transformSys.update(entities);
      skyboxSys.update(entities);
      cameraSys.update(entities);
    },
    render: (entities, cameraEntity) => {
      resourceCache.beginFrame();
      renderGraph.beginFrame();

      reflectionProbeSys.update(entities, {
        renderers: [skyboxRendererSys],
      });

      const renderView = {
        camera: cameraEntity.camera,
        cameraEntity: cameraEntity,
        viewport: [0, 0, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight],
      };

      renderPipelineSys.update(entities, {
        renderers: [
          standardRendererSystem,
          lineRendererSystem,
          skyboxRendererSys,
          helperRendererSys,
        ],
        renderView: renderView,
      });

      renderGraph.endFrame();
      resourceCache.endFrame();
    },
  };
  return engine;
}
