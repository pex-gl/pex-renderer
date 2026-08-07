import { mat4 } from "pex-math";
import { submit, createSampler } from "pex-gpu";

import createBaseSystem from "./base.js";
import { skyboxShader } from "../../shaders/skybox.js";
import { NAMESPACE, TEMP_MAT4 } from "../../utils.js";

import type {
  Entity,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

/**
 * Skybox renderer
 *
 * Draws an equirectangular environment map (a baked analytic sky or a user
 * envMap) as the scene background, built on the `skybox` WGSL generator. A
 * single @group(0) holds the uSkybox uniforms plus the env map and its
 * sampler.
 */
export default ({ ctx, resourceCache }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "skybox-renderer",
  debug: false,
  sampler: createSampler(ctx, { filter: "linear" }),

  getShader: (defines: Set<string>, options: any) =>
    skyboxShader(defines, options),
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
  getVariantKey(entity: any, defines: Set<string>) {
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

  checkSkybox(skybox: any) {
    if (skybox.envMap || skybox._skyTexture) return true;
    console.warn(
      NAMESPACE,
      this.type,
      `skybox component missing texture. Provide an "envMap" or add a skyboxSystem.update(world.entities).`,
    );
  },

  render(renderView: RenderView, entity: Entity, options: any) {
    if (!this.checkSkybox(entity.skybox)) return;

    const { camera } = renderView;
    const texture = entity.skybox!.envMap || entity.skybox!._skyTexture;

    const pipeline = this.getPipeline(entity, options);

    submit(ctx, {
      label: "drawSkyboxCmd",
      pipeline,
      ...resourceCache.fullscreenTriangle(),
      uniforms: {
        uSkybox: {
          projectionMatrix: camera.projectionMatrix,
          viewMatrix: camera.viewMatrix,
          modelMatrix:
            entity._transform?.modelMatrix || mat4.identity(TEMP_MAT4),
          exposure: entity.skybox!.exposure ?? 1,
        },
        uEnvMap: texture,
        uEnvMapSampler: this.sampler,
      },
    });
  },
  renderBackground(
    renderView: RenderView,
    entities: Entity[],
    options: any = {},
  ) {
    const { attachmentsLocations = {}, msaa } = options;
    this._msaa = msaa;
    this._locations = {
      normal: attachmentsLocations.normal ?? -1,
      emissive: attachmentsLocations.emissive ?? -1,
    };

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]!;
      if (
        entity.skybox &&
        (entity.skybox.sunPosition || entity.skybox.envMap)
      ) {
        this.render(renderView, entity, options);
      }
    }
  },
});
