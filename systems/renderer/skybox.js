import { mat4 } from "pex-math";
import { skybox as SHADERS } from "pex-shaders";

import createBaseSystem from "./base.js";
import { NAMESPACE, ProgramCache } from "../../utils.js";

// Impacts program caching
// prettier-ignore
const flagDefinitions = [
  [["options", "attachmentsLocations", "color"], "LOCATION_COLOR", { type: "value" }],
  [["options", "attachmentsLocations", "normal"], "LOCATION_NORMAL", { type: "value" }],
  [["options", "attachmentsLocations", "emissive"], "LOCATION_EMISSIVE", { type: "value" }],
];

export default ({ ctx, resourceCache }) => {
  const identityMatrix = mat4.create();

  const fullscreenQuad = resourceCache.fullscreenQuad();

  const drawSkyboxCommand = {
    name: "drawSkyboxCmd",
    attributes: {
      aPosition: fullscreenQuad.attributes.aPosition,
    },
    indices: fullscreenQuad.indices,
  };

  const skyboxRendererSystem = Object.assign(createBaseSystem({ ctx }), {
    type: "skybox-renderer",
    cache: {
      // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default) and list of flags
      programs: new ProgramCache(),
      // Cache based on: program.id, material.blend and material.id (if present)
      pipelines: {},
    },
    debug: false,
    checkReflectionProbe(reflectionProbe) {
      if (!reflectionProbe._reflectionProbe?._reflectionMap) {
        console.warn(
          NAMESPACE,
          this.type,
          `reflectionProbe component missing _reflectionProbe. Add a reflectionProbeSystem.update(entities, { renderers: [skyboxRendererSystem] }).`
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
          `skybox component missing texture. Provide a "envMap" or add a skyboxSystem.update(world.entities).`
        );
      } else {
        return true;
      }
    },
    flagDefinitions,
    getVertexShader: () => SHADERS.skybox.vert,
    getFragmentShader: () => SHADERS.skybox.frag,
    getPipelineOptions: () => ({ depthTest: true, depthWrite: false }),
    render(renderView, entity, options) {
      const pipeline = this.getPipeline(ctx, entity, options);

      const {
        renderingToReflectionProbe,
        outputEncoding,
        backgroundBlur,
        reflectionProbeEntity,
      } = options;

      //TODO
      // if (!this.texture && this.dirty) {
      // this.updateSkyTexture();
      // }

      // texture can bed
      // - skybox.texture
      // - skybox._skyTexture
      // - this.backgroundTexture
      // - this._reflectionProbe._reflectionMap

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
        texture = entity.skybox.envMap || entity.skybox._skyTexture;
      } else {
        return;
      }

      // TODO: rename, for oct map. Why * 2 ? Cause it is oct map atlas?
      const envMapSize = reflectionProbeEntity?.reflectionProbe?.size * 2 || 0;

      const cmd = drawSkyboxCommand;
      cmd.pipeline = pipeline;
      cmd.uniforms = {
        // viewport: camera.viewport,
        // scissor: camera.viewport,
        uExposure: !renderingToReflectionProbe
          ? renderView.camera.exposure || 1
          : 1, //TODO: hardcoded default from camera.exposure
        uOutputEncoding: outputEncoding,

        uProjectionMatrix: renderView.camera.projectionMatrix,
        uViewMatrix: renderView.camera.viewMatrix,
        uModelMatrix: entity._transform?.modelMatrix || identityMatrix,

        uEnvMap: texture,
        uEnvMapEncoding: texture.encoding,
        uEnvMapSize: envMapSize,
        uBackgroundBlur: !renderingToReflectionProbe ? backgroundBlur : false,
      };

      ctx.submit(drawSkyboxCommand);
    },
    renderStages: {
      background: (renderView, entities, options = {}) => {
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (entity.skybox) {
            skyboxRendererSystem.render(renderView, entity, {
              ...options,
              renderingToReflectionProbe: options.renderingToReflectionProbe,
              backgroundBlur: entity.skybox.backgroundBlur,
              outputEncoding: renderView.outputEncoding || ctx.Encoding.Linear,
              reflectionProbeEntity: entities.find(
                (entity) => entity.reflectionProbe
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
    },
  });

  return skyboxRendererSystem;
};
