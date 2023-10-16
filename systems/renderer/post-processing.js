import { postProcessing as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { ProgramCache } from "../../utils.js";

// Impacts pipeline caching
const pipelineProps = ["blend"];

export default ({ ctx, resourceCache }) => {
  const postProcessingSystem = Object.assign(createBaseSystem({ ctx }), {
    type: "post-processing-renderer",
    cache: {
      // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default), list of flags and material hooks
      programs: new ProgramCache(),
      // Cache based on: program.id, material.blend and material.id (if present)
      pipelines: {},
      // Cache based on: renderViewId, pass.name and passCommand.name
      targets: {},
    },
    debug: false,
    debugRender: "",
    getVertexShader: ({ command }) =>
      command.vert || SHADERS.postProcessing.vert,
    getFragmentShader: ({ command }) => command.frag,
    getPipelineHash(_, { command }) {
      return this.getHashFromProps(command, pipelineProps, this.debug);
    },
    getPipelineOptions(_, { command }) {
      return { blend: command.blend };
    },
    render(
      renderView,
      _,
      { colorAttachments, depthAttachment, descriptors, passes }
    ) {
      const postProcessing = renderView.cameraEntity.postProcessing;

      const renderViewId = renderView.cameraEntity.id;

      this.cache.targets[renderViewId] ||= {};
      this.cache.targets[renderViewId][`color`] = colorAttachments.color;

      // Expose targets for other renderers (eg. standard to use AO)
      postProcessing._targets = this.cache.targets;

      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];

        if (pass.name !== "final" && !postProcessing[pass.name]) continue;

        for (let j = 0; j < pass.commands.length; j++) {
          const passCommand = pass.commands[j];

          if (passCommand.disabled?.(renderView)) continue;

          this.flagDefinitions = passCommand.flagDefinitions;

          // Also computes this.uniforms
          const pipeline = this.getPipeline(ctx, renderView.cameraEntity, {
            command: passCommand,
            targets: this.cache.targets[renderView.cameraEntity.id],
          });

          const viewportSize = passCommand.size?.(renderView) || [
            renderView.viewport[2],
            renderView.viewport[3],
          ];

          const sharedUniforms = {
            uViewport: renderView.viewport,
            uViewportSize: viewportSize,
            uTexelSize: [1 / viewportSize[0], 1 / viewportSize[1]],
          };

          const source = passCommand.source?.(renderView);
          const target = passCommand.target?.(renderView);

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
            ...passCommand.uniforms?.(renderView),
          };

          // TODO: move to descriptors
          if (pass.name === "final") {
            uniforms.uTextureEncoding = uniforms.uTexture.encoding;
          }

          Object.assign(uniforms, sharedUniforms, this.uniforms);

          // Set command
          const fullscreenTriangle = resourceCache.fullscreenTriangle();

          const postProcessingCmd = {
            name: `${pass.name}.${passCommand.name}`,
            pass: resourceCache.pass({
              color: [outputColor],
              ...passCommand.passDesc?.(renderView),
            }),
            pipeline,
            uniforms,
            attributes: fullscreenTriangle.attributes,
            count: fullscreenTriangle.count,
          };

          ctx.submit(postProcessingCmd);

          // TODO: delete from cache somehow on pass. Loop through this.postProcessingPasses?
          // eg. Object.keys(this.cache.targets[renderViewId]).filter(key => key.startsWidth(`${pass.name}.`))
          this.cache.targets[renderViewId][postProcessingCmd.name] =
            outputColor;

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
    renderStages: {
      post: (renderView, entities, options) => {
        postProcessingSystem.render(renderView, entities, options);
      },
    },
  });

  return postProcessingSystem;
};
