import { postProcessing as postProcessingShaders } from "pex-shaders";
import createPipelineCache from "../../pipeline-cache.js";
import ssao from "./post-processing/ssao.js";
import dof from "./post-processing/dof.js";
import bloom from "./post-processing/bloom.js";
import final from "./post-processing/final.js";

// Impacts pipeline caching
const pipelineProps = ["blend"];

const getPostProcessingPasses = (options) => [
  { name: "ssao", passes: ssao(options) },
  { name: "dof", passes: dof(options) },
  { name: "bloom", passes: bloom(options) },
  { name: "final", passes: final(options) },
];

export default ({ ctx, renderGraph, resourceCache }) => ({
  postProcessingEffects: null,
  renderPostProcessing(
    renderView,
    colorAttachments,
    depthAttachment,
    descriptors,
  ) {
    const renderViewId = renderView.cameraEntity.id;

    const postProcessingComponent = renderView.cameraEntity.postProcessing;

    if (!this.pipelineCache) {
      this.pipelineCache = createPipelineCache(ctx);

      // Cache based on: renderViewId, pass.name and subPass.name
      this.pipelineCache.cache.targets = {};
    }

    // Expose targets for other renderers (eg. standard to use AO)
    postProcessingComponent._targets = this.pipelineCache.cache.targets; //TODO: hack

    this.pipelineCache.cache.targets[renderViewId] ||= {};
    this.pipelineCache.cache.targets[renderViewId]["color"] =
      colorAttachments.color;

    this.postProcessingEffects ||= getPostProcessingPasses({
      ctx,
      resourceCache,
      descriptors: this.descriptors,
    });

    for (let i = 0; i < this.postProcessingEffects.length; i++) {
      const effect = this.postProcessingEffects[i];
      const isFinal = effect.name == "final";
      const isEffectUsed = !!postProcessingComponent[effect.name];

      if (!isEffectUsed && !isFinal) continue;

      for (let j = 0; j < effect.passes.length; j++) {
        const subPass = effect.passes[j];
        const isEnabled = !subPass.enabled || subPass.enabled(renderView);

        if (!isEnabled) continue;

        const passName = `${effect.name}.${subPass.name}`;

        const { pipeline, uniforms: pipelineUniforms } =
          this.pipelineCache.getPipeline(
            ctx,
            renderView.cameraEntity,
            {
              hash: this.pipelineCache.getHashFromProps(
                subPass,
                pipelineProps,
                this.debug,
              ),
              flagDefinitions: subPass.flagDefinitions,
              targets: this.pipelineCache.cache.targets[renderViewId],
              vert: subPass.vert || postProcessingShaders.postProcessing.vert,
              frag: subPass.frag,
              debug: this.debug,
            },
            { blend: subPass.blend },
          );

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
              ? this.pipelineCache.cache.targets[renderViewId][source]
              : source;

          if (!inputColor) console.warn(`Missing source ${source}.`);
        } else {
          inputColor = colorAttachments.color;
        }

        let outputColor;
        if (target) {
          outputColor =
            typeof target === "string"
              ? this.pipelineCache.cache.targets[renderViewId][target]
              : target;
          if (!outputColor) console.warn(`Missing target ${target}.`);
        } else {
          // TODO: allow size overwrite for down/upscale
          const textureDesc = isFinal
            ? descriptors.postProcessing.finalTextureDesc
            : descriptors.postProcessing.outputTextureDesc;
          textureDesc.width = renderView.viewport[2];
          textureDesc.height = renderView.viewport[3];

          outputColor = resourceCache.texture2D(textureDesc);
        }
        outputColor.name = `postProcessingPassColorOutput ${passName} (id: ${outputColor.id})`;

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

        Object.assign(uniforms, sharedUniforms, pipelineUniforms);

        // Set command
        const fullscreenTriangle = resourceCache.fullscreenTriangle();
        //neded for name
        let postProcessingCmd = {
          name: passName,
          pipeline,
          uniforms,
          attributes: fullscreenTriangle.attributes,
          count: fullscreenTriangle.count,
        };

        const usedUniformNames = Object.keys(
          postProcessingCmd.pipeline.program.uniforms,
        );
        const textureUniformNames = usedUniformNames.filter(
          (name) =>
            postProcessingCmd.pipeline.program.uniforms[name].type == 35678,
        );

        const uses = textureUniformNames.map(
          (name) => postProcessingCmd.uniforms[name],
        );

        const renderPassView = {
          //FIXME: this seems to be wrong
          viewport: [0, 0, outputColor.width, outputColor.height],
        };

        renderGraph.renderPass({
          name: `PostProcessingPass.${passName} [${renderPassView.viewport}]`,
          uses: uses.filter(Boolean),
          renderView: renderPassView,
          pass: resourceCache.pass({
            name: `postProcessingPass.${passName}`,
            color: [outputColor],
            ...subPass.passDesc?.(renderView),
          }),
          render: () => {
            ctx.submit(postProcessingCmd);
          },
        });

        // TODO: delete from cache somehow on pass. Loop through this.postProcessingPasses?
        // eg. Object.keys(this.cache.targets[renderViewId]).filter(key => key.startsWidth(`${pass.name}.`))
        this.pipelineCache.cache.targets[renderViewId][passName] = outputColor;

        // Draw to screen
        if (!target) {
          colorAttachments.color = outputColor;
        }

        colorAttachments[passName] = outputColor;
      }
    }
  },
});
