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
    const fullscreenTriangle = resourceCache.fullscreenTriangle();

    /*
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
    */

    const renderViewId = renderView.cameraEntity.id;

    const postProcessingComponent = renderView.cameraEntity.postProcessing;

    // Expose targets for other renderers (eg. standard to use AO)
    postProcessingComponent._targets = this.cache.targets; //TODO: hack

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

    this.tempBaseRenderer.cache.targets[renderViewId] ||= {};
    this.tempBaseRenderer.cache.targets[renderViewId]["color"] =
      colorAttachments.color;

    postProcessingEffects ||= getPostProcessingPasses({
      ctx,
      resourceCache,
      descriptors: this.descriptors,
    });

    console.logOnce = function (...args) {
      if (ctx.frameNumber != 10) return;
      console.log(...args);
    };

    postProcessingEffects.forEach((effect) => {
      const isFinal = effect.name == "final";
      const isEffectUsed = !!postProcessingComponent[effect.name];

      console.logOnce(
        `post-pro: ${effect.name} ${effect.passes.length} ${isEffectUsed || isFinal}`,
      );

      if (!isEffectUsed && !isFinal) {
        return;
      }

      effect.passes.forEach((subPass) => {
        const isEnabled = !subPass.disabled?.(renderView);

        if (!isEnabled && !isFinal) return;
        console.logOnce(`  ${subPass.name} ${isEnabled}`);

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

        const postProcessingCmd = {
          name: `${effect.name}.${subPass.name}`,
          pass: resourceCache.pass({
            color: [outputColor],
            // ...subPass.passDesc?.(renderView),
            // clearColor: [0, 0, 0, 1],
          }),
          pipeline,
          uniforms,
          attributes: fullscreenTriangle.attributes,
          count: fullscreenTriangle.count,
        };

        // ctx.debug(true);
        ctx.submit(postProcessingCmd); //TEMP
        // ctx.debug(false);

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
