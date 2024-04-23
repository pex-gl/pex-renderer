import { postProcessing as SHADERS } from "pex-shaders";

import createBaseSystem from "../renderer/base.js";
import { ProgramCache } from "../../../utils.js";

// Impacts pipeline caching
const pipelineProps = ["blend"];

/**
 * Post-Processing renderer
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.postProcessing
 */
export default ({ ctx, resourceCache }) => ({
  ...createBaseSystem(),
  type: "post-processing-renderer",
  cache: {
    // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default), list of flags and material hooks
    programs: new ProgramCache(),
    // Cache based on: program.id, material.blend and material.id (if present)
    pipelines: {},
    // Cache based on: renderViewId, pass.name and subPass.name
    targets: {},
  },
  debug: false,
  debugRender: "",
  getVertexShader: ({ subPass }) => subPass.vert || SHADERS.postProcessing.vert,
  getFragmentShader: ({ subPass }) => subPass.frag,
  getPipelineHash(_, { subPass }) {
    return this.getHashFromProps(subPass, pipelineProps, this.debug);
  },
  getPipelineOptions(_, { subPass }) {
    return { blend: subPass.blend };
  },
  render(
    renderView,
    _,
    { colorAttachments, depthAttachment, descriptors, passes },
  ) {
    const postProcessing = renderView.cameraEntity.postProcessing;

    const renderViewId = renderView.cameraEntity.id;

    this.cache.targets[renderViewId] ||= {};
    this.cache.targets[renderViewId]["color"] = colorAttachments.color;

    // Expose targets for other renderers (eg. standard to use AO)
    postProcessing._targets = this.cache.targets;

    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];
      const isFinal = pass.name === "final";

      if (!isFinal && !postProcessing[pass.name]) continue;

      for (let j = 0; j < pass.passes.length; j++) {
        const subPass = pass.passes[j];

        if (subPass.disabled?.(renderView)) continue;

        // Set flag definitions for pipeline retrieval
        this.flagDefinitions = subPass.flagDefinitions;

        // Also computes this.uniforms
        const pipeline = this.getPipeline(ctx, renderView.cameraEntity, {
          subPass,
          targets: this.cache.targets[renderViewId],
        });

        const viewportSize = subPass.size?.(renderView) || [
          renderView.viewport[2],
          renderView.viewport[3],
        ];

        const sharedUniforms = {
          uViewport: renderView.viewport,
          uViewportSize: viewportSize,
          uTexelSize: [1 / viewportSize[0], 1 / viewportSize[1]],
          uTime: this.time,
        };

        const source = subPass.source?.(renderView);
        const target = subPass.target?.(renderView);

        // Resolve attachments
        let inputColor;
        if (source) {
          inputColor =
            typeof source === "string"
              ? this.cache.targets[renderViewId][source]
              : source;

          if (!inputColor) console.warn(`Missing source ${source}.`);
        } else {
          inputColor = colorAttachments.color;
        }

        let outputColor;
        if (target) {
          outputColor =
            typeof target === "string"
              ? this.cache.targets[renderViewId][target]
              : target;
          if (!outputColor) console.warn(`Missing target ${target}.`);
        } else {
          // TODO: allow size overwrite for down/upscale
          const { outputTextureDesc } = { ...descriptors.postProcessing };
          outputTextureDesc.width = renderView.viewport[2];
          outputTextureDesc.height = renderView.viewport[3];
          outputColor = resourceCache.texture2D(outputTextureDesc);
        }

        const uniforms = {
          // TODO: only add required attachments
          uTexture: inputColor,
          uDepthTexture: depthAttachment,
          uNormalTexture: colorAttachments.normal,
          uEmissiveTexture: colorAttachments.emissive,
          ...subPass.uniforms?.(renderView),
        };

        // TODO: move to descriptors
        if (isFinal) {
          uniforms.uTextureEncoding = uniforms.uTexture.encoding;
        }

        Object.assign(uniforms, sharedUniforms, this.uniforms);

        // Set command
        const fullscreenTriangle = resourceCache.fullscreenTriangle();

        const postProcessingCmd = {
          name: `${pass.name}.${subPass.name}`,
          pass: resourceCache.pass({
            color: [outputColor],
            ...subPass.passDesc?.(renderView),
          }),
          pipeline,
          uniforms,
          attributes: fullscreenTriangle.attributes,
          count: fullscreenTriangle.count,
        };

        ctx.submit(postProcessingCmd);

        // TODO: delete from cache somehow on pass. Loop through this.postProcessingPasses?
        // eg. Object.keys(this.cache.targets[renderViewId]).filter(key => key.startsWidth(`${pass.name}.`))
        this.cache.targets[renderViewId][postProcessingCmd.name] = outputColor;

        // Draw to screen
        if (!target) colorAttachments.color = outputColor;
      }
    }

    if (
      this.debugRender &&
      this.cache.targets[renderViewId][this.debugRender]
    ) {
      colorAttachments.color =
        this.cache.targets[renderViewId][this.debugRender];
    }
  },
  renderPost(renderView, entities, options) {
    this.render(renderView, entities, options);
  },
});
