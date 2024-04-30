import { getPostProcessingPasses } from "./post-processing-passes.js";
import ceateBaseRenderer from "../renderer/base.js";
import { postProcessing as postProcessingShaders } from "pex-shaders";
import createSAODescriptors from "./post-processing/sao.js";
import { ProgramCache } from "../../../utils.js";

// Impacts pipeline caching
const pipelineProps = ["blend"];
let postProcessingEffects = null;

export default ({ ctx, renderGraph, resourceCache }) => ({
  // postProcessingDescriptors: {
  //   sao: createSAODescriptors({ ctx, resourceCache }),
  // },
  renderPostProcessing(
    renderView,
    colorAttachments,
    depthAttachment,
    descriptors,
  ) {
    const renderViewId = renderView.cameraEntity.id;

    const postProcessingComponent = renderView.cameraEntity.postProcessing;

    if (!this.tempBaseRenderer) {
      this.tempBaseRenderer = ceateBaseRenderer();
      this.tempBaseRenderer.cache = {
        // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default), list of flags and material hooks
        programs: new ProgramCache(),
        // Cache based on: program.id, material.blend and material.id (if present)
        pipelines: {},
        // Cache based on: renderViewId, pass.name and subPass.name
        targets: {},
      };
    }

    // Expose targets for other renderers (eg. standard to use AO)
    postProcessingComponent._targets = this.tempBaseRenderer.cache.targets; //TODO: hack

    this.tempBaseRenderer.cache.targets[renderViewId] ||= {};
    this.tempBaseRenderer.cache.targets[renderViewId]["color"] =
      colorAttachments.color;

    postProcessingEffects ||= getPostProcessingPasses({
      ctx,
      resourceCache,
      descriptors: this.descriptors,
    });

    postProcessingEffects.forEach((effect) => {
      const isFinal = effect.name == "final";
      const isEffectUsed = !!postProcessingComponent[effect.name];

      if (!isEffectUsed && !isFinal) {
        return;
      }

      effect.passes.forEach((subPass) => {
        const isEnabled = !subPass.disabled?.(renderView);

        if (!isEnabled && !isFinal) return;

        // Set flag definitions for pipeline retrieval
        // this.flagDefinitions = subPass.flagDefinitions;
        this.tempBaseRenderer.flagDefinitions = subPass.flagDefinitions;

        this.tempBaseRenderer.getVertexShader = ({ subPass }) =>
          subPass.vert || postProcessingShaders.postProcessing.vert;

        this.tempBaseRenderer.getFragmentShader = ({ subPass }) => subPass.frag;

        this.tempBaseRenderer.getPipelineHash = function (_, { subPass }) {
          return this.getHashFromProps(subPass, pipelineProps, this.debug);
        };
        this.tempBaseRenderer.getPipelineOptions = function (_, { subPass }) {
          return { blend: subPass.blend };
        };

        // Also computes this.uniforms
        const pipeline = this.tempBaseRenderer.getPipeline(
          ctx,
          renderView.cameraEntity,
          {
            subPass,
            targets: this.tempBaseRenderer.cache.targets[renderViewId],
          },
        );

        const viewportSize = subPass.size?.(renderView) || [
          renderView.viewport[2],
          renderView.viewport[3],
        ];

        const sharedUniforms = {
          uViewport: renderView.viewport,
          uViewportSize: viewportSize,
          uTexelSize: [1 / viewportSize[0], 1 / viewportSize[1]],
          uTime: this.time || 0,
        };

        const source = subPass.source?.(renderView);
        const target = subPass.target?.(renderView);

        // Resolve attachments
        let inputColor;
        if (source) {
          inputColor =
            typeof source === "string"
              ? this.tempBaseRenderer.cache.targets[renderViewId][source]
              : source;

          if (!inputColor) console.warn(`Missing source ${source}.`);
        } else {
          inputColor = colorAttachments.color;
        }

        let outputColor;
        if (target) {
          outputColor =
            typeof target === "string"
              ? this.tempBaseRenderer.cache.targets[renderViewId][target]
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

        Object.assign(uniforms, sharedUniforms, this.tempBaseRenderer.uniforms);

        // Set command
        const fullscreenTriangle = resourceCache.fullscreenTriangle();
        //neded for name
        let postProcessingCmd = {
          name: `${effect.name}.${subPass.name}`,
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

        renderGraph.renderPass({
          name: `PostProcessing.${effect.name}.${subPass.name}`,
          uses: uses.filter(Boolean),
          renderView: {
            //FIXME: this seems to be wrong
            viewport: [0, 0, outputColor.width, outputColor.height],
          },
          pass: resourceCache.pass({
            name: `PostProcessing.${effect.name}.${subPass.name}`,
            color: [outputColor],
            ...subPass.passDesc?.(renderView),
          }),
          render: () => {
            ctx.submit(postProcessingCmd);
          },
        });

        // TODO: delete from cache somehow on pass. Loop through this.postProcessingPasses?
        // eg. Object.keys(this.cache.targets[renderViewId]).filter(key => key.startsWidth(`${pass.name}.`))
        this.tempBaseRenderer.cache.targets[renderViewId][
          postProcessingCmd.name
        ] = outputColor;

        // Draw to screen
        if (!target) colorAttachments.color = outputColor;
        colorAttachments[postProcessingCmd.name] = outputColor;
        window.colorAttachments = colorAttachments;
      });
    });
  },
});
