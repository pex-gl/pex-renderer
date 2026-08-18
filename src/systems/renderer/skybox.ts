import { mat3 } from "pex-math";
import { submit, createSampler } from "pex-gpu";

import createBaseSystem from "./base.js";
import { skyboxShader } from "../../shaders/skybox.js";
import {
  NAMESPACE,
  TEMP_MAT3,
  definesKey,
  getEnvironmentRotation,
} from "../../utils.js";
import createFullscreenGeometry from "../../fullscreen-geometry.js";

import type {
  Entity,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

const IDENTITY_MAT3 = mat3.create();

/**
 * Skybox renderer
 *
 * Draws an equirectangular environment map (a baked analytic sky or a user
 * envMap) as the scene background, built on the `skybox` WGSL generator. A
 * single @group(0) holds the uSkybox uniforms plus the env map and its
 * sampler.
 *
 * The skybox entity's own transform drives environment rotation for both
 * the background (equirect or, with backgroundBlur, the paired
 * reflectionProbe's cubemap) and material IBL — see utils.js's
 * getEnvironmentRotation, applied the same way in systems/reflection-probe.ts.
 *
 * `skybox.backgroundBlur` (0-1) is sampled from the paired reflectionProbe
 * entity's prefiltered specular cubemap instead of a dedicated blur pass —
 * the same source `standard.ts` uses for material reflections.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "skybox-renderer",
  debug: false,
  sampler: createSampler(ctx, { filter: "linear" }),
  // Entity ids already warned about a missing reflectionProbe, so the warning
  // fires once instead of every frame.
  _warnedBackgroundBlur: new Set<number>(),

  getShader: (defines: Set<string>, options: any) =>
    skyboxShader(defines, options),
  getShaderOptions() {
    const { _locations } = this;
    return {
      locationNormal: _locations.normal ?? -1,
      locationEmissive: _locations.emissive ?? -1,
    };
  },
  getDefines(entity: Entity) {
    const defines = new Set();
    if (this._locations.normal >= 0 || this._locations.emissive >= 0) {
      defines.add("USE_DRAW_BUFFERS");
    }
    if (this._msaa) defines.add("USE_MSAA");
    if (this._reflectionProbe && (entity.skybox!.backgroundBlur ?? 0) > 0) {
      defines.add("USE_BACKGROUND_BLUR");
    }
    return defines;
  },
  getVariantKey(entity: any, defines: Set<string>) {
    return [
      definesKey(defines),
      this._locations.normal ?? -1,
      this._locations.emissive ?? -1,
    ].join("_");
  },
  getPipelineOptions(entity: Entity) {
    return {
      depthWriteEnabled: false,
      depthCompare: "less-equal",
      cullMode: "none",
      ...(this._reflectionProbe && (entity.skybox!.backgroundBlur ?? 0) > 0
        ? { constants: { ROUGHNESS_LEVELS: this._reflectionProbe.roughnessLevels } }
        : {}),
    };
  },

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
    const skybox = entity.skybox!;
    const texture = skybox.envMap || skybox._skyTexture;

    const backgroundBlur = skybox.backgroundBlur ?? 0;
    const useBackgroundBlur = !!this._reflectionProbe && backgroundBlur > 0;

    if (backgroundBlur > 0 && !this._reflectionProbe) {
      if (!this._warnedBackgroundBlur.has(entity.id)) {
        this._warnedBackgroundBlur.add(entity.id);
        console.warn(
          NAMESPACE,
          this.type,
          "skybox.backgroundBlur requires a paired reflectionProbe entity; rendering unblurred.",
          entity,
        );
      }
    }

    const pipeline = this.getPipeline(entity, options);

    submit(ctx, {
      label: "drawSkyboxCmd",
      pipeline,
      ...createFullscreenGeometry(ctx).triangle,
      uniforms: {
        uSkybox: {
          projectionMatrix: camera.projectionMatrix!,
          viewMatrix: camera.viewMatrix!,
          rotation:
            getEnvironmentRotation(TEMP_MAT3, entity._transform?.modelMatrix) ??
            IDENTITY_MAT3,
          exposure: skybox.exposure ?? 1,
          backgroundBlur,
        },
        uEnvMap: texture!,
        uEnvMapSampler: this.sampler,
        ...(useBackgroundBlur && {
          uSpecularEnvMap: this._reflectionProbe!.specularTexture,
          uSpecularEnvMapSampler: this._reflectionProbe!.sampler,
        }),
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

    // Reused from material IBL (see systems/reflection-probe.ts): the same
    // prefiltered specular cubemap drives skybox.backgroundBlur, picking a
    // mip via lod instead of a dedicated background blur pass.
    const probeEntity = entities.find((e) => e._reflectionProbe);
    this._reflectionProbe = probeEntity?._reflectionProbe;

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
