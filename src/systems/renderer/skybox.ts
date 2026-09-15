import { mat3, mat4 } from "pex-math";
import { submit, createSampler } from "pex-gpu";

import createBaseSystem, { NO_JITTER, outputsKey } from "./base.js";
import { skyboxShader } from "../../shaders/skybox.js";
import {
  NAMESPACE,
  TEMP_MAT3,
  definesKey,
  getEnvironmentRotation,
  getSkyboxEnvMap,
} from "../../utils.js";
import createFullscreenGeometry from "../../fullscreen-geometry.js";

import type {
  PipelineShaderOptions,
  Entity,
  RendererPassOptions,
  RendererSystem,
  RenderView,
  SystemOptions,
} from "../../types.js";

const IDENTITY_MAT3 = mat3.create();
const IDENTITY_MAT4 = mat4.create();

/**
 * Skybox renderer
 *
 * Draws an equirectangular environment map (a baked analytic sky or a user
 * envMap) as the scene background, built on the `skybox` WGSL generator. A
 * single `@group(0)` holds the uSkybox uniforms plus the env map and its
 * sampler.
 *
 * The skybox entity's own transform drives environment rotation for both the
 * background (equirect or, with backgroundBlur, the paired reflectionProbe's
 * cubemap) and material IBL — see utils.js's getEnvironmentRotation, applied
 * the same way in systems/reflection-probe.ts.
 *
 * `skybox.backgroundBlur` (0-1) is sampled from the paired reflectionProbe
 * entity's prefiltered specular cubemap instead of a dedicated blur pass — the
 * same source `standard.ts` uses for material reflections.
 */
export default ({ ctx }: SystemOptions): RendererSystem => ({
  ...createBaseSystem(),
  type: "skybox-renderer",
  debug: false,
  sampler: createSampler(ctx, { filter: "linear" }),
  // Entity ids already warned about a missing reflectionProbe, so the warning
  // fires once instead of every frame.
  _warnedBackgroundBlur: new Set<number>(),

  getShader: (defines: Set<string>, options: PipelineShaderOptions) =>
    skyboxShader(defines, options),
  getShaderOptions(_entity: Entity, options: RendererPassOptions) {
    return { outputs: options.outputs };
  },
  getDefines(entity: Entity, options: RendererPassOptions) {
    const defines = new Set<string>();
    if (options.msaa) defines.add("USE_MSAA");
    if (this.useBackgroundBlur(entity, options)) {
      defines.add("USE_BACKGROUND_BLUR");
    }
    return defines;
  },
  getVariantKey(
    entity: any,
    defines: Set<string>,
    options: RendererPassOptions,
  ) {
    return `${definesKey(defines)}_${outputsKey(options.outputs)}`;
  },
  getPipelineOptions(entity: Entity, options: RendererPassOptions) {
    return {
      depthWriteEnabled: false,
      depthCompare: "less-equal",
      cullMode: "none",
      ...(this.useBackgroundBlur(entity, options)
        ? {
            constants: {
              ROUGHNESS_LEVELS: options.reflectionProbe!.roughnessLevels,
            },
          }
        : {}),
    };
  },

  /**
   * `backgroundBlur` reads the paired probe's prefiltered cubemap, so it can
   * only apply where the view has one.
   */
  useBackgroundBlur(entity: Entity, options: RendererPassOptions) {
    return (
      !!options.reflectionProbe && (entity.skybox!.backgroundBlur ?? 0) > 0
    );
  },

  checkSkybox(skybox: any) {
    if (getSkyboxEnvMap(skybox)) return true;
    console.warn(
      NAMESPACE,
      this.type,
      `skybox component missing texture. Provide an "envMap" or add a skyboxSystem.update(world.entities).`,
    );
  },

  render(renderView: RenderView, entity: Entity, options: RendererPassOptions) {
    if (!this.checkSkybox(entity.skybox)) return;

    const { camera } = renderView;
    const skybox = entity.skybox!;
    const texture = getSkyboxEnvMap(skybox);

    const backgroundBlur = skybox.backgroundBlur ?? 0;
    const useBackgroundBlur = this.useBackgroundBlur(entity, options);

    if (
      backgroundBlur > 0 &&
      !options.reflectionProbe &&
      !this._warnedBackgroundBlur.has(entity.id)
    ) {
      this._warnedBackgroundBlur.add(entity.id);
      console.warn(
        NAMESPACE,
        this.type,
        "skybox.backgroundBlur requires a paired reflectionProbe entity; rendering unblurred.",
        entity,
      );
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
          luminanceScale: skybox._luminanceScale ?? 1,
          cameraExposure: camera._exposure ?? 1,
          backgroundBlur,
          jitter: camera._jitter ?? NO_JITTER,
          previousViewProjectionMatrix:
            camera._previousViewProjectionMatrix ?? IDENTITY_MAT4,
        },
        uEnvMap: texture!,
        uEnvMapSampler: this.sampler,
        ...(useBackgroundBlur && {
          uSpecularEnvMap: options.reflectionProbe!.specularTexture,
          uSpecularEnvMapSampler: options.reflectionProbe!.sampler,
        }),
      },
    });
  },
  // The probe reaching here is reused from material IBL (see
  // systems/reflection-probe.ts): the same prefiltered specular cubemap drives
  // skybox.backgroundBlur, picking a mip via lod rather than a blur pass.
  renderBackground(
    renderView: RenderView,
    entities: Entity[],
    options: RendererPassOptions = {},
  ) {
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
