import { mat4 } from "pex-math";
import { submit, createSampler } from "pex-gpu";
import * as SHADERS from "../../shaders/index.js";

import createBaseSystem from "./base.js";
import { NAMESPACE, TEMP_MAT4 } from "../../utils.js";

/**
 * Skybox renderer
 *
 * Draws an equirectangular environment map (a baked analytic sky or a user
 * envMap) as the scene background, built on the `skybox` WGSL generator. A
 * single @group(0) holds the uSkybox uniforms plus the env map and its sampler.
 *
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.skybox
 */
export default ({ ctx, resourceCache }) => ({
  ...createBaseSystem(),
  type: "skybox-renderer",
  debug: false,
  sampler: createSampler(ctx, { filter: "linear" }),

  getShader: (defines, options) => SHADERS.skybox(defines, options),
  getShaderOptions() {
    const { _locations } = this;
    return {
      locationNormal: _locations.normal ?? -1,
      locationEmissive: _locations.emissive ?? -1,
    };
  },
  getDefines() {
    const defines = new Set();
    if (this._locations.normal >= 0 || this._locations.emissive >= 0) {
      defines.add("USE_DRAW_BUFFERS");
    }
    if (this._msaa) defines.add("USE_MSAA");
    return defines;
  },
  getVariantKey(entity, defines) {
    return [
      [...defines].sort().join("|"),
      this._locations.normal ?? -1,
      this._locations.emissive ?? -1,
    ].join("_");
  },
  getPipelineOptions: () => ({
    depthWriteEnabled: false,
    depthCompare: "less-equal",
    cullMode: "none",
  }),

  checkSkybox(skybox) {
    if (skybox.envMap || skybox._skyTexture) return true;
    console.warn(
      NAMESPACE,
      this.type,
      `skybox component missing texture. Provide an "envMap" or add a skyboxSystem.update(world.entities).`,
    );
  },

  render(renderView, entity, options) {
    if (!this.checkSkybox(entity.skybox)) return;

    const { camera } = renderView;
    const texture = entity.skybox.envMap || entity.skybox._skyTexture;

    const pipeline = this.getPipeline(ctx, entity, options);

    submit(ctx, {
      name: "drawSkyboxCmd",
      pipeline,
      ...resourceCache.fullscreenTriangle(),
      uniforms: {
        uSkybox: {
          projectionMatrix: camera.projectionMatrix,
          viewMatrix: camera.viewMatrix,
          modelMatrix: entity._transform?.modelMatrix || mat4.identity(TEMP_MAT4),
          exposure: entity.skybox.exposure ?? 1,
        },
        uEnvMap: texture,
        uEnvMapSampler: this.sampler,
      },
    });
  },
  renderBackground(renderView, entities, options = {}) {
    const { attachmentsLocations = {}, msaa } = options;
    this._msaa = msaa;
    this._locations = {
      normal: attachmentsLocations.normal ?? -1,
      emissive: attachmentsLocations.emissive ?? -1,
    };

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.skybox && (entity.skybox.sunPosition || entity.skybox.envMap)) {
        this.render(renderView, entity, options);
      }
    }
  },
});
