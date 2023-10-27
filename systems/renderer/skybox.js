import { mat4 } from "pex-math";
import { skybox as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { NAMESPACE, ProgramCache, TEMP_MAT4 } from "../../utils.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
  [["options", "toneMap"], "TONE_MAP", { type: "value" }],
];

/**
 * Skybox renderer
 *
 * Renders a skybox (envMap or _skyTexture) to screen or to reflection probes.
 * @param {import("../../types.js").SystemOptions} options
 * @returns {import("../../types.js").RendererSystem}
 */
export default ({ ctx, resourceCache }) => ({
  ...createBaseSystem(),
  type: "skybox-renderer",
  cache: {
    programs: new ProgramCache(),
    pipelines: {},
  },
  debug: false,
  checkReflectionProbe(reflectionProbe) {
    if (!reflectionProbe._reflectionProbe?._reflectionMap) {
      console.warn(
        NAMESPACE,
        this.type,
        `reflectionProbe component missing _reflectionProbe. Add a reflectionProbeSystem.update(entities, { renderers: [skyboxRendererSystem] }).`,
      );
    } else {
      return true;
    }
  },
  checkSkybox(skybox) {
    if (!(skybox.envMap || skybox._skyTexture)) {
      console.warn(
        NAMESPACE,
        this.type,
        `skybox component missing texture. Provide a "envMap" or add a skyboxSystem.update(world.entities).`,
      );
    } else {
      return true;
    }
  },
  flagDefinitions,
  cmd: null,
  getVertexShader: () => SHADERS.skybox.vert,
  getFragmentShader: () => SHADERS.skybox.frag,
  getPipelineOptions: () => ({ depthTest: true, depthWrite: false }),
  render(renderView, entity, options) {
    const backgroundBlur = entity.skybox.backgroundBlur;
    const { renderingToReflectionProbe, reflectionProbeEntity } = options;

    let texture;

    if (
      !renderingToReflectionProbe &&
      backgroundBlur &&
      reflectionProbeEntity
    ) {
      if (this.checkReflectionProbe(reflectionProbeEntity)) {
        texture = reflectionProbeEntity._reflectionProbe._reflectionMap;
      } else {
        return;
      }
    } else if (this.checkSkybox(entity.skybox)) {
      // TODO: should update _skyTexture happen here or stay in skybox system?
      texture = entity.skybox.envMap || entity.skybox._skyTexture;
    } else {
      return;
    }

    const pipeline = this.getPipeline(ctx, entity, options);

    this.cmd ||= {
      name: "drawSkyboxCmd",
      ...resourceCache.fullscreenTriangle(),
    };

    this.cmd.pipeline = pipeline;
    this.cmd.uniforms = {
      uExposure: !renderingToReflectionProbe
        ? renderView.camera.exposure ?? 1
        : 1, //TODO: hardcoded default from camera.exposure
      uOutputEncoding: renderView.outputEncoding || ctx.Encoding.Linear,

      uProjectionMatrix: renderView.camera.projectionMatrix,
      uViewMatrix: renderView.camera.viewMatrix,
      uModelMatrix: entity._transform?.modelMatrix || mat4.identity(TEMP_MAT4),

      uEnvMap: texture,
      // Encoding comes from either envMap or skyTexture (ideally linear)
      uEnvMapEncoding: texture.encoding,
      uEnvMapExposure: entity.skybox.exposure ?? 1,
      // TODO: rename, for oct map. Why * 2 ? Cause it is oct map atlas?
      uEnvMapSize: reflectionProbeEntity?.reflectionProbe?.size * 2 || 0,
      uBackgroundBlur: !renderingToReflectionProbe ? backgroundBlur : false,
    };

    ctx.submit(this.cmd);
  },
  renderBackground(renderView, entities, options = {}) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (
        entity.skybox &&
        (entity.skybox.sunPosition || entity.skybox.envMap)
      ) {
        this.render(renderView, entity, {
          ...options,
          toneMap: renderView.toneMap,
          outputEncoding: renderView.outputEncoding,
          reflectionProbeEntity: entities.find(
            (entity) => entity.reflectionProbe,
          ),
        });
        // entity._skybox.draw(renderView.camera, {
        //   backgroundMode: true,
        //   outputEncoding: ctx.Encoding.Linear,
        // });
        // ctx.submit(skyboxCmd, {
        //   attributes: entity._geometry.attributes,
        //   indices: entity._geometry.indices,
        //   uniforms: {
        //     uBaseColor: entity.material.baseColor,
        //     uProjectionMatrix: renderView.camera.projectionMatrix,
        //     uViewMatrix: renderView.camera.viewMatrix,
        //     uModelMatrix: entity._transform.modelMatrix,
        //   },
        // });
      }
    }
  },
});
