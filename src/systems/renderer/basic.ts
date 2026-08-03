import { mat3 } from "pex-math";
import { submit } from "pex-gpu";
import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";

// Reused per draw: uniforms are packed synchronously at submit(), so a single
// scratch matrix is safe across entities within a frame. Unused by the unlit
// shader but part of the shared Model uniform struct layout.
const NORMAL_MATRIX = mat3.create();

// Premultiplied "over" blend, matching the previous One / OneMinusSrcAlpha setup.
const ALPHA_BLEND = {
  color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
};

/**
 * Basic renderer
 *
 * Unlit draw path built on pex-shaders' `basic` WGSL generator. Uniforms follow
 * the shared bind group struct convention: @group(0) Frame, @group(2) Material,
 * @group(3) Model.
 *
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.basic
 */
export default ({ ctx }) => ({
  ...createBaseSystem(),
  type: "basic-renderer",
  debug: false,
  getShader: (defines, options) => SHADERS.basic(defines, options),
  getDefines(entity) {
    const defines = new Set();
    const { attributes } = entity._geometry;
    if (attributes.offset) defines.add("USE_INSTANCED_OFFSET");
    if (attributes.scale) defines.add("USE_INSTANCED_SCALE");
    if (attributes.rotation) defines.add("USE_INSTANCED_ROTATION");
    if (attributes.instanceColor) defines.add("USE_INSTANCED_COLOR");
    if (attributes.vertexColor) defines.add("USE_VERTEX_COLORS");
    return defines;
  },
  getVariantKey(entity, defines) {
    return `${[...defines].sort().join("|")}_${entity.material.blend ? 1 : 0}`;
  },
  getPipelineOptions(entity) {
    const { material } = entity;
    return {
      depthWriteEnabled: material.depthWrite !== false && !material.blend,
      cullMode: (material.cullFace ?? true) ? "back" : "none",
      ...(material.blend ? { blend: ALPHA_BLEND } : {}),
    };
  },
  render(renderView, entities, options) {
    const { camera, cameraEntity, viewport } = renderView;

    const uFrame = {
      projectionMatrix: camera.projectionMatrix,
      viewMatrix: camera.viewMatrix,
      inverseViewMatrix: camera.invViewMatrix || camera.inverseViewMatrix,
      cameraPosition: cameraEntity._transform.worldPosition,
      viewportSize: [viewport[2], viewport[3]],
    };

    const renderableEntities = entities.filter(
      (entity) =>
        entity.geometry &&
        entity.material &&
        entity.material.type === undefined &&
        (options.transparent ? entity.material.blend : !entity.material.blend),
    );

    for (let i = 0; i < renderableEntities.length; i++) {
      const entity = renderableEntities[i];

      const pipeline = this.getPipeline(ctx, entity, options);

      submit(ctx, {
        name: options.transparent
          ? "drawTransparentBasicGeometryCmd"
          : "drawBasicGeometryCmd",
        pipeline,
        attributes: entity._geometry.attributes,
        indices: entity._geometry.indices,
        count: entity._geometry.count,
        instanceCount: entity._geometry.instances,
        uniforms: {
          uFrame,
          uModel: {
            modelMatrix: entity._transform.modelMatrix,
            normalMatrix: mat3.fromMat4(
              NORMAL_MATRIX,
              entity._transform.modelMatrix,
            ),
          },
          uMaterial: { baseColor: entity.material.baseColor },
        },
      });
    }
  },
  renderOpaque(renderView, entities, options) {
    this.render(renderView, entities, { ...options, transparent: false });
  },
  renderTransparent(renderView, entities, options) {
    this.render(renderView, entities, { ...options, transparent: true });
  },
});
