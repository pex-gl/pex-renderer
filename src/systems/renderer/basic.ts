import { mat3, mat4 } from "pex-math";
import { submit } from "pex-gpu";
import { basicShader, BASIC_VERTEX_FIELDS } from "../../shaders/basic.js";

import createBaseSystem, { outputsKey } from "./base.js";
import { definesKey, hooksKey } from "../../utils.js";

import type {
  PipelineShaderOptions,
  Entity,
  RendererPassOptions,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

// Reused per draw: uniforms are packed synchronously at submit(), so a single
// scratch matrix is safe across entities within a frame. Unused by the unlit
// shader but part of the shared Model uniform struct layout.
const NORMAL_MATRIX = mat3.create();

/**
 * Basic renderer
 *
 * Unlit draw path built. Uniforms follow
 * the shared bind group struct convention: `@group(0)` Frame, `@group(2)`
 * Material, `@group(3)` Model.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "basic-renderer",
  debug: false,
  getShader: (defines: Set<string>, options: PipelineShaderOptions) =>
    basicShader(defines, options),
  getDefines(entity: Entity) {
    const defines = new Set<string>();
    this.getFeatureFlags(
      entity._geometry!.attributes,
      BASIC_VERTEX_FIELDS,
      defines,
    );
    return defines;
  },
  getShaderOptions(entity: Entity, options: RendererPassOptions) {
    return { outputs: options.outputs, hooks: entity.material!.hooks };
  },
  getVariantKey(
    entity: Entity,
    defines: Set<string>,
    options: RendererPassOptions,
  ) {
    return [
      definesKey(defines),
      entity.material!.blend ? 1 : 0,
      hooksKey(entity.material!.hooks),
      // Decides the shape of FragmentOutput, so two passes writing different
      // attachments cannot share a pipeline.
      outputsKey(options.outputs),
    ].join("_");
  },
  getPipelineOptions(entity: Entity) {
    const material = entity.material!;
    const blend = this.getPipelineBlend(material.blend);
    return {
      depthWriteEnabled: material.depthWriteEnabled ?? !blend,
      depthCompare: material.depthCompare ?? "less-equal",
      cullMode: material.cullMode ?? "back",
      topology: entity._geometry!.topology ?? "triangle-list",
      // A negative-determinant node transform (e.g. a negative scale) mirrors
      // space and reverses triangle winding — per spec, front-facing flips
      // from CCW to CW along with it.
      frontFace:
        mat4.determinant(entity._transform!.modelMatrix) < 0 ? "cw" : "ccw",
      ...(blend ? { blend } : {}),
    };
  },
  render(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    const uFrame = this.getFrameUniforms(renderView);

    const renderableEntities = entities.filter(
      (entity) =>
        entity.geometry &&
        entity.material &&
        entity.material.type === undefined &&
        (options.transparent ? entity.material.blend : !entity.material.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i]!;

      const pipeline = this.getPipeline(entity, options);

      submit(ctx, {
        label: options.transparent
          ? "drawTransparentBasicGeometryCmd"
          : "drawBasicGeometryCmd",
        pipeline,
        attributes: entity._geometry!.attributes,
        indices: entity._geometry!.indices,
        count: entity._geometry!.count,
        instanceCount: entity._geometry!.instanceCount,
        uniforms: {
          uFrame,
          ...this.getModelUniforms(
            entity,
            mat3.fromMat4(NORMAL_MATRIX, entity._transform!.modelMatrix),
            // The shader declares no skin bindings, so the block carries none.
            { previousModelMatrix: !!options.outputs?.velocity },
          ),
          uMaterial: { baseColor: entity.material!.baseColor! },
          ...this.getHookUniforms(entity, options.frameIndex ?? NaN),
        },
      });
    }
  },
  renderOpaque(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions,
  ) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
});
