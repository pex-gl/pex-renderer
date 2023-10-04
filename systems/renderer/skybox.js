import { mat4 } from "pex-math";
import { skybox as SHADERS, parser as ShaderParser } from "pex-shaders";
import { NAMESPACE } from "../../utils.js";

export default ({ ctx, resourceCache }) => {
  // const skyboxCmd = {
  //   name: "skyboxCmd",
  //   pipeline: ctx.pipeline({
  //     vert: /*glsl*/ `
  //     attribute vec3 aPosition;
  //     uniform mat4 uProjectionMatrix;
  //     uniform mat4 uViewMatrix;
  //     uniform mat4 uModelMatrix;
  //     void main() {
  //       gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
  //     }
  //     `,
  //     frag: /*glsl*/ `
  //     precision highp float;
  //     uniform vec4 uBaseColor;
  //     void main() {
  //       gl_FragData[0] = uBaseColor;
  //     }
  //     `,
  //     depthWrite: true,
  //     depthTest: true,
  //   }),
  // };

  const identityMatrix = mat4.create();

  const fullscreenQuad = resourceCache.fullscreenQuad();

  const drawSkyboxCommand = {
    name: "drawSkyboxCmd",
    pipeline: ctx.pipeline({
      vert: ShaderParser.build(ctx, SHADERS.skybox.vert),
      frag: ShaderParser.build(ctx, SHADERS.skybox.frag, [
        ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
      ]),
      depthTest: true,
      depthWrite: false,
    }),
    attributes: {
      aPosition: fullscreenQuad.attributes.aPosition,
    },
    indices: fullscreenQuad.indices,
    uniforms: {
      uUseTonemapping: false,
      uExposure: 1,
    },
  };

  const skyboxRendererSystem = {
    type: "skybox-renderer",
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
    render(
      renderView,
      entity,
      {
        renderingToReflectionProbe,
        outputEncoding,
        backgroundBlur,
        reflectionProbeEntity,
      }
    ) {
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

      //TODO: useTonemapping hardcoded to false
      const useTonemapping = false;
      ctx.submit(drawSkyboxCommand, {
        // viewport: camera.viewport,
        // scissor: camera.viewport,
        uniforms: {
          uProjectionMatrix: renderView.camera.projectionMatrix,
          uViewMatrix: renderView.camera.viewMatrix,
          uModelMatrix: entity._transform?.modelMatrix || identityMatrix,
          uEnvMap: texture,
          uEnvMapEncoding: texture.encoding,
          uEnvMapSize: envMapSize,
          uOutputEncoding: outputEncoding,
          uBackgroundBlur: !renderingToReflectionProbe ? backgroundBlur : false,
          uUseTonemapping: !renderingToReflectionProbe ? useTonemapping : false,
          uExposure: !renderingToReflectionProbe
            ? renderView.camera.exposure || 1
            : 1, //TODO: hardcoded default from camera.exposure
        },
      });
    },
    renderStages: {
      background: (renderView, entities, options) => {
        const { renderingToReflectionProbe } = options;
        for (let i = 0; i < entities.length; i++) {
          const entity = entities[i];
          if (entity.skybox) {
            skyboxRendererSystem.render(renderView, entity, {
              renderingToReflectionProbe: renderingToReflectionProbe,
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
    update() {},
  };

  return skyboxRendererSystem;
};
