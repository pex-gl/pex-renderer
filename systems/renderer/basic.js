import { pipeline as SHADERS, parser as ShaderParser } from "pex-shaders";

import {
  buildProgram,
  getMaterialFlagsAndUniforms,
  shadersPostReplace,
  ProgramCache,
  getHashFromProps,
} from "./utils.js";
import { NAMESPACE } from "../../utils.js";

// Impacts program caching
const flagDefs = [
  [["material", "blend"], "USE_BLEND", { type: "boolean" }],
  [["material", "baseColor"], "", { uniform: "uBaseColor" }],
  [["geometry", "attributes", "aOffset"], "USE_INSTANCED_OFFSET"],
  [["geometry", "attributes", "aScale"], "USE_INSTANCED_SCALE"],
  [["geometry", "attributes", "aRotation"], "USE_INSTANCED_ROTATION"],
  [["geometry", "attributes", "aColor"], "USE_INSTANCED_COLOR"],
  [["geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
];

// Impacts pipeline caching
const pipelineMaterialProps = ["id", "blend"];

export default ({ ctx }) => {
  const basicRendererSystem = {
    type: "basic-renderer",
    cache: {
      // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default), list of flags and material hooks
      programs: new ProgramCache(),
      // Cache based on: program.id, material.blend and material.id (if present)
      pipelines: {},
    },
    debug: false,
    getProgram(ctx, entity) {
      const { material } = entity;
      const { flags, materialUniforms } = getMaterialFlagsAndUniforms(
        ctx,
        entity,
        flagDefs
      );
      // TODO: materialUniforms are never cached?
      this.materialUniforms = materialUniforms;

      const descriptor = {
        vert: material.vert || SHADERS.basic.vert,
        frag: material.frag || SHADERS.basic.frag,
      };
      shadersPostReplace(descriptor, entity, this.materialUniforms);

      const { vert, frag } = descriptor;

      let program = this.cache.programs.get(flags, vert, frag);
      if (!program) {
        try {
          if (this.debug) {
            console.debug(NAMESPACE, this.type, "new program", flags, entity);
          }
          program = buildProgram(
            ctx,
            ShaderParser.build(ctx, vert, flags),
            ShaderParser.build(ctx, frag, flags)
          );
          this.cache.programs.set(flags, vert, frag, program);
        } catch (error) {
          console.error(NAMESPACE, error);
          console.warn(
            NAMESPACE,
            "glsl error",
            ShaderParser.getFormattedError(error, { vert, frag })
          );
        }
      }

      return program;
    },
    getPipeline(ctx, entity) {
      const program = this.getProgram(ctx, entity);

      const hash = `${program.id}${getHashFromProps(
        entity.material,
        pipelineMaterialProps
      )}`;

      if (!this.cache.pipelines[hash] || entity.material.needsPipelineUpdate) {
        entity.material.needsPipelineUpdate = false;
        if (this.debug) {
          console.debug(
            NAMESPACE,
            this.type,
            "new pipeline",
            program.id,
            getHashFromProps(entity.material, pipelineMaterialProps, true),
            entity
          );
        }
        this.cache.pipelines[hash] = ctx.pipeline({
          program,
          depthWrite: !entity.material.blend,
          depthTest: true,
          ...(entity.material.blend
            ? {
                blend: true,
                blendSrcRGBFactor: ctx.BlendFactor.One,
                blendSrcAlphaFactor: ctx.BlendFactor.One,
                blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
                blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
              }
            : {}),
        });
      }

      return this.cache.pipelines[hash];
    },
    render(renderView, entities, { transparent }) {
      const sharedUniforms = {
        uProjectionMatrix: renderView.camera.projectionMatrix,
        uViewMatrix: renderView.camera.viewMatrix,
      };

      const renderableEntities = entities.filter(
        (entity) =>
          entity.geometry &&
          entity.material &&
          entity.material.type === undefined &&
          (transparent ? entity.material.blend : !entity.material.blend)
      );

      for (let i = 0; i < renderableEntities.length; i++) {
        const entity = renderableEntities[i];

        // Also computes this.materialUniforms
        const pipeline = this.getPipeline(ctx, entity);

        const uniforms = { uModelMatrix: entity._transform.modelMatrix };
        Object.assign(uniforms, sharedUniforms, this.materialUniforms);

        ctx.submit({
          name: transparent
            ? "drawTransparentBasicGeometryCmd"
            : "drawBasicGeometryCmd",
          pipeline,
          attributes: entity._geometry.attributes,
          indices: entity._geometry.indices,
          instances: entity._geometry.instances,
          uniforms,
        });
      }
    },
    renderStages: {
      opaque: (renderView, entities) => {
        basicRendererSystem.render(renderView, entities, {
          transparent: false,
        });
      },
      transparent: (renderView, entities) => {
        basicRendererSystem.render(renderView, entities, { transparent: true });
      },
    },
    update: () => {},
  };

  return basicRendererSystem;
};
