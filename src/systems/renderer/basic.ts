import { mat3 } from "pex-math";
import { submit } from "pex-gpu";
import { basicShader, BASIC_VERTEX_FIELDS } from "../../shaders/basic.js";

import createBaseSystem, { BLEND_MODES } from "./base.js";
import { definesKey } from "../../utils.js";

import type {
  BlendMode,
  Entity,
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
 * Unlit draw path built on pex-shaders' `basic` WGSL generator. Uniforms follow
 * the shared bind group struct convention: @group(0) Frame, @group(2)
 * Material,
 *
 * @group(3) Model.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "basic-renderer",
  debug: false,
  getShader: (defines: Set<string>, options: any) =>
    basicShader(defines, options),
  getDefines(entity: any) {
    const defines = new Set<string>();
    this.getFeatureFlags(
      entity._geometry.attributes,
      BASIC_VERTEX_FIELDS,
      defines,
    );
    return defines;
  },
  getVariantKey(entity: any, defines: Set<string>) {
    return `${definesKey(defines)}_${entity.material.blend ? 1 : 0}`;
  },
  getPipelineOptions(entity: any) {
    const { material } = entity;
    return {
      depthWriteEnabled: material.depthWrite !== false && !material.blend,
      cullMode: (material.cullFace ?? true) ? "back" : "none",
      ...(material.blend
        ? { blend: BLEND_MODES[(material.blendMode ?? "normal") as BlendMode] }
        : {}),
    };
  },
  render(renderView: RenderView, entities: Entity[], options: any) {
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
        instanceCount: entity._geometry!.instances,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform!.modelMatrix,
            normalMatrix: mat3.fromMat4(
              NORMAL_MATRIX,
              entity._transform!.modelMatrix,
            ),
            // Only where the shader declared it: pex-gpu throws on an unknown
            // struct member, and modelStruct gates this on the velocity output.
            ...(this._outputs?.velocity && {
              previousModelMatrix: entity._transform!.previousModelMatrix,
            }),
          },
          uMaterial: { baseColor: entity.material!.baseColor! },
        },
      });
    }
  },
  renderOpaque(renderView: RenderView, entities: Entity[], options: any) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(renderView: RenderView, entities: Entity[], options: any) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
});
