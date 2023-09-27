import { postProcessing as SHADERS, parser as ShaderParser } from "pex-shaders";
import {
  ProgramCache,
  buildProgram,
  getHashFromProps,
  getMaterialFlagsAndUniforms,
} from "./utils.js";
import { NAMESPACE } from "../../utils.js";

// Impacts pipeline caching
const pipelineProps = ["blend"];

export default ({ ctx, resourceCache }) => {
  const postProcessingSystem = {
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
    getProgram(ctx, entity, command) {
      const { flags, materialUniforms } = getMaterialFlagsAndUniforms(
        ctx,
        entity,
        command.flagDefs || {},
        { targets: this.cache.targets[entity.id] }
      );
      // TODO: materialUniforms are never cached?
      this.materialUniforms = materialUniforms;

      const descriptor = {
        vert: command.vert || SHADERS.postProcessing.vert,
        frag: command.frag, // TODO: should there be default?
      };
      // shadersPostReplace(descriptor, entity, this.materialUniforms);

      const { vert, frag } = descriptor;

      let program = this.cache.programs.get(flags, vert, frag);
      if (!program) {
        if (this.debug) {
          console.debug(NAMESPACE, this.type, "new program", flags, entity);
        }
        program = buildProgram(
          ctx,
          ShaderParser.build(ctx, vert, flags),
          ShaderParser.build(ctx, frag, flags)
        );
        this.cache.programs.set(flags, vert, frag, program);
      }

      return program;
    },
    getPipeline(ctx, entity, command) {
      const program = this.getProgram(ctx, entity, command);

      const hash = `${program.id}${getHashFromProps(command, pipelineProps)}`;

      if (!this.cache.pipelines[hash] || command.needsPipelineUpdate) {
        command.needsPipelineUpdate = false;
        if (this.debug) {
          console.debug(
            NAMESPACE,
            this.type,
            "new pipeline",
            program.id,
            getHashFromProps(command, pipelineProps, true),
            entity
          );
        }
        this.cache.pipelines[hash] = ctx.pipeline({
          program,
          blend: command.blend,
        });
      }

      return this.cache.pipelines[hash];
    },
    render(renderView, _, { attachments, descriptors, passes }) {
      const postProcessing = renderView.cameraEntity.postProcessing;

      const renderViewId = renderView.cameraEntity.id;

      this.cache.targets[renderViewId] ||= {};
      this.cache.targets[renderViewId][`color`] = attachments.color;

      // Expose targets for other renderers (eg. standard to use AO)
      postProcessing._targets = this.cache.targets;

      for (let i = 0; i < passes.length; i++) {
        const pass = passes[i];

        if (pass.name !== "final" && !postProcessing[pass.name]) continue;

        for (let j = 0; j < pass.commands.length; j++) {
          const passCommand = pass.commands[j];

          // Also computes this.materialUniforms
          const pipeline = this.getPipeline(
            ctx,
            renderView.cameraEntity,
            passCommand
          );

          const sharedUniforms = {
            uViewport: renderView.viewport,
            uViewportSize: passCommand.size?.(renderView) || [
              renderView.viewport[2],
              renderView.viewport[3],
            ],
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
            inputColor = attachments.color;
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
            uTexture: inputColor,
            uDepthTexture: attachments.depth,
            uNormalTexture: attachments.normal,
            uEmissiveTexture: attachments.emissive,
            ...passCommand.uniforms?.(renderView),
          };

          // TODO: move to descriptors
          if (pass.name === "final") {
            uniforms.uTextureEncoding = uniforms.uTexture.encoding;
          }

          Object.assign(uniforms, sharedUniforms, this.materialUniforms);

          // Set command
          // TODO: allow pass options like clearColor
          // Get descriptors
          const passDesc = {
            color: [outputColor],
            ...passCommand.passDesc?.(renderView),
          };

          const fullscreenTriangle = resourceCache.fullscreenTriangle();

          const postProcessingCmd = {
            name: `${pass.name}.${passCommand.name}`,
            pass: resourceCache.pass(passDesc),
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
          if (!target) attachments.color = outputColor;
        }
      }

      if (
        this.debugRender &&
        this.cache.targets[renderViewId][this.debugRender]
      ) {
        attachments.color = this.cache.targets[renderViewId][this.debugRender];
      }
    },
    renderStages: {
      post: (renderView, entities, options) => {
        postProcessingSystem.render(renderView, entities, options);
      },
    },
    update: () => {},
  };

  return postProcessingSystem;
};
