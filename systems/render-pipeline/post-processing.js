import { getPostProcessingPasses } from "./post-processing-passes.js";
import ceateBaseRenderer from "../renderer/base.js";
import { postProcessing as postProcessingShaders } from "pex-shaders";
import createSAODescriptors from "./post-processing/sao.js";

export default ({ ctx, renderGraph, resourceCache }) => ({
  postProcessingDescriptors: {
    sao: createSAODescriptors({ ctx, resourceCache }),
  },
  renderPostProcessing(renderPassView, colorAttachments, depthAttachment) {
    const fullscreenTriangle = resourceCache.fullscreenTriangle();
    const viewport = [
      0,
      0,
      ctx.gl.drawingBufferWidth,
      ctx.gl.drawingBufferHeight,
    ];

    const subPass = this.postProcessingDescriptors.sao;

    const saoNoiseTexture = resourceCache.texture2D(
      this.postProcessingDescriptors.sao.saoNoiseTextureDesc,
    );

    renderPassView.cameraEntity.postProcessing.ssao._saoNoiseTexture =
      saoNoiseTexture; //TEMP: sao texture injection

    // base renderer ---------

    if (!this.tempBaseRenderer) {
      this.tempBaseRenderer = ceateBaseRenderer();
    }

    this.tempBaseRenderer.getVertexShader = ({ subPass }) =>
      subPass.vert || postProcessingShaders.postProcessing.vert;

    this.tempBaseRenderer.getFragmentShader = ({ subPass }) => subPass.frag;

    //inject flag definitions
    this.tempBaseRenderer.flagDefinitions =
      this.postProcessingDescriptors.sao.flagDefinitions;

    //get pipeline
    const pipeline = this.tempBaseRenderer.getPipeline(
      ctx,
      renderPassView.cameraEntity,
      {
        subPass,
      },
    );

    //sniff back uniforms
    const uniforms = this.tempBaseRenderer.uniforms;

    // base renderer end ---------

    const viewportSize = subPass.size?.(renderPassView) || [
      renderPassView.viewport[2],
      renderPassView.viewport[3],
    ];

    const sharedUniforms = {
      uViewport: renderPassView.viewport,
      uViewportSize: viewportSize,
      uTexelSize: [1 / viewportSize[0], 1 / viewportSize[1]],
      uTime: this.time || 0,
    };

    renderGraph.renderPass({
      name: `PostProcessingFinalPass [${renderPassView.viewport}]`,
      uses: [depthAttachment].filter(Boolean),
      renderView: renderPassView,
      pass: resourceCache.pass({
        name: "postProcessingFinalPass",
        color: [colorAttachments.color],
        // depth: depthAttachment,
        clearColor: [1, 1, 1, 1],
      }),
      render: () => {
        const postProcessingFinalPassCmd = {
          name: "postProcessingFinalPassCmd",
          attributes: fullscreenTriangle.attributes,
          count: fullscreenTriangle.count,
          pipeline,
          uniforms: {
            uViewport: viewport,
            uTexture: saoNoiseTexture,
            uDepthTexture: depthAttachment,
            uNormalTexture: colorAttachments.normal,
            ...uniforms,
            ...sharedUniforms,
          },
        };
        ctx.submit(postProcessingFinalPassCmd);
      },
    });

    const postProcessingEffects = getPostProcessingPasses({
      ctx,
      resourceCache,
      descriptors: this.descriptors,
    });

    console.logOnce = function (...args) {
      if (ctx.frameNumber != 10) return;
      console.log(...args);
    };

    const postProcessingComponent = renderPassView.cameraEntity.postProcessing;
    postProcessingEffects.forEach((effect) => {
      const isFinal = effect.name == "final";
      const isUsed = !!postProcessingComponent[effect.name];

      console.logOnce(
        `post-pro: ${effect.name} ${effect.passes.length} ${isUsed || isFinal}`,
      );
      effect.passes.forEach((pass) => {
        const isEnabled = !pass.disabled?.(renderPassView);
        console.logOnce(`  ${pass.name} ${isEnabled}`);
      });
    });
  },
});
