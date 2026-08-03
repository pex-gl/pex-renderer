/**
 * Base renderer
 *
 * All renderers are composed with it. Pipelines are cached per shader variant:
 * pex-gpu treats a RenderPipeline's WGSL source as immutable per object
 * identity, so a new object is only needed when the generated source changes
 * (its `defines`). Mutable state (blend, cull, depth) is re-applied per draw on
 * the cached object.
 *
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.base
 */
export default () => ({
  type: "base-renderer",
  pipelineCache: new Map(),
  debug: false,
  /** WGSL source generator: (defines: Set<string>, options) => string. */
  getShader() {
    return "";
  },
  getShaderOptions() {
    return {};
  },
  getDefines() {
    return new Set();
  },
  getVariantKey(entity, defines) {
    return [...defines].sort().join("|");
  },
  getPipelineOptions() {
    return {};
  },
  getPipeline(ctx, entity, options = {}) {
    const defines = this.getDefines(entity, options);
    const key = this.getVariantKey(entity, defines, options);

    let pipeline = this.pipelineCache.get(key);
    if (!pipeline) {
      const source = this.getShader(
        defines,
        this.getShaderOptions(entity, options),
      );
      pipeline = { vertex: source, fragment: source };
      this.pipelineCache.set(key, pipeline);
    }

    // Blend/cull/depth may change between draws without a new pipeline object.
    Object.assign(pipeline, this.getPipelineOptions(entity, options));

    if (entity.material) entity.material.needsPipelineUpdate = false;
    return pipeline;
  },
  // render(renderView, entities, options) {},
  // renderBackground(renderView, entities, options) {},
  // renderShadow(renderView, entities, options) {},
  // renderOpaque(renderView, entities, options) {},
  // renderTransparent(renderView, entities, options) {},
  // renderPost(renderView, entities, options) {},
  update() {},
  dispose() {
    this.pipelineCache.clear();
  },
});
