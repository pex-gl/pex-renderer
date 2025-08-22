import { pipeline as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],

  [["material", "blend"], "USE_BLEND"],
  [["material", "baseColor"], "", { uniform: "uBaseColor" }],
  [["_geometry", "attributes", "aOffset"], "USE_INSTANCED_OFFSET"],
  [["_geometry", "attributes", "aScale"], "USE_INSTANCED_SCALE"],
  [["_geometry", "attributes", "aRotation"], "USE_INSTANCED_ROTATION"],
  [["_geometry", "attributes", "aColor"], "USE_INSTANCED_COLOR"],
  [["_geometry", "attributes", "aVertexColor"], "USE_VERTEX_COLORS"],
];

// Impacts pipeline caching
const pipelineMaterialProps = ["id", "blend"];

/**
 * Basic renderer
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.basic
 */
export default ({ ctx }) => ({
  ...createBaseSystem(),
  type: "basic-renderer",
  debug: false,
  flagDefinitions,
  getVertexShader: () => SHADERS.basic.vert,
  getFragmentShader: () => SHADERS.basic.frag,
  getPipelineHash(entity) {
    return this.getHashFromProps(
      entity.material,
      pipelineMaterialProps,
      this.debug,
    );
  },
  getPipelineOptions(entity) {
    return {
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
    };
  },
  render(renderView, entities, options) {
    const sharedUniforms = {
      uExposure: renderView.exposure,
      uOutputEncoding: renderView.outputEncoding,

      uProjectionMatrix: renderView.camera.projectionMatrix,
      uViewMatrix: renderView.camera.viewMatrix,
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

      // Also computes this.uniforms
      const pipeline = this.getPipeline(ctx, entity, options);

      const uniforms = { uModelMatrix: entity._transform.modelMatrix };
      Object.assign(uniforms, sharedUniforms, this.uniforms);

      ctx.submit({
        name: options.transparent
          ? "drawTransparentBasicGeometryCmd"
          : "drawBasicGeometryCmd",
        pipeline,
        attributes: entity._geometry.attributes,
        indices: entity._geometry.indices,
        instances: entity._geometry.instances,
        uniforms,
        multiDraw: entity.geometry.multiDraw,
      });
    }
  },
  renderOpaque(renderView, entities, options) {
    this.render(renderView, entities, {
      ...options,
      toneMap: renderView.toneMap,
      transparent: false,
    });
  },
  renderTransparent(renderView, entities, options) {
    this.render(renderView, entities, {
      ...options,
      toneMap: renderView.toneMap,
      transparent: true,
    });
  },
});
