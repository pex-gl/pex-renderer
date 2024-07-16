import createPipelineCache from "../../pipeline-cache.js";

/**
 * Base renderer
 *
 * All renderers are composed with it.
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.base
 */
export default () => ({
  type: "base-renderer",
  pipelineCache: createPipelineCache(),
  debug: false,
  time: 0, //TODO MARCIN: why renderers have time?
  getVertexShader(options) {
    return "";
  },
  getFragmentShader(options) {
    return "";
  },
  getHashFromProps(obj, props, debug) {
    return this.pipelineCache.getHashFromProps(obj, props, debug);
  },
  getPipelineHash(entity, options) {
    return "";
  },
  getPipelineOptions(entity, options) {
    return {};
  },
  getPipeline(ctx, entity, options = {}) {
    const { pipeline, uniforms: pipelineUniforms } =
      this.pipelineCache.getPipeline(
        ctx,
        entity,
        {
          ...options,
          hash: this.getPipelineHash(entity, options),
          flagDefinitions: this.flagDefinitions,
          vert: this.getVertexShader(options),
          frag: this.getFragmentShader(options),
        },
        this.getPipelineOptions(entity, options),
      );

    if (entity.material) entity.material.needsPipelineUpdate = false;
    this.uniforms = pipelineUniforms;
    return pipeline;
  },
  // render(renderView, entities, options) {},
  // renderBackground(renderView, entities, options) {},
  // renderShadow(renderView, entities, options) {},
  // renderOpaque(renderView, entities, options) {},
  // renderTransparent(renderView, entities, options) {},
  // renderPost(renderView, entities, options) {},
  update(_, { time }) {
    this.time = time;
  },
  // TODO: dispose pipelineCache
  dispose() {},
});
