import { skybox } from "./pex-shaders/index.js";
import { patchVS, patchFS } from "../../utils.js";
import { mat4 } from "pex-math";

export default function createSkyboxRendererSystem(opts) {
  const { ctx } = opts;

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

  const DRAW_BUFFERS_EXT =
    ctx.capabilities.maxColorAttachments > 1 ? "#define USE_DRAW_BUFFERS" : "";

  const skyboxPositions = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const skyboxFaces = [
    [0, 1, 2],
    [0, 2, 3],
  ];

  const skyboxFrag = `
  ${DRAW_BUFFERS_EXT}
  ${skybox.skybox.frag}`;

  const drawCommand = {
    name: "Skybox.draw",
    pipeline: ctx.pipeline({
      vert: ctx.capabilities.isWebGL2
        ? patchVS(skybox.skybox.vert)
        : skybox.skybox.vert,
      frag: ctx.capabilities.isWebGL2 ? patchFS(skyboxFrag) : skyboxFrag,
      depthTest: true,
      depthWrite: false,
    }),
    attributes: {
      aPosition: ctx.vertexBuffer(skyboxPositions),
    },
    indices: ctx.indexBuffer(skyboxFaces),
    uniforms: {
      uUseTonemapping: false,
      uExposure: 1,
    },
  };

  function draw(ctx, skybox, camera, opts) {
    const { entity, projectionMatrix, viewMatrix, exposure } = camera;
    const {
      renderingToReflectionProbe,
      outputEncoding,
      backgroundBlur,
      reflectionProbeEntity,
    } = opts;
    //TODO
    // if (!this.texture && this.dirty) {
    // this.updateSkyTexture();
    // }

    // texture can bed
    // - skybox.texture
    // - skybox._skyTexture
    // - this.backgroundTexture
    // - this._reflectionProbe._reflectionMap

    let texture = skybox.envMap || skybox._skyTexture;

    if (
      !renderingToReflectionProbe &&
      backgroundBlur &&
      reflectionProbeEntity
    ) {
      texture = reflectionProbeEntity._reflectionProbe._reflectionMap;
    }

    // TODO: rename, for oct map. Why * 2 ? Cause it is oct map atlas?
    const reflectionProbeMapSize =
      reflectionProbeEntity?.reflectionProbe?.mapSize * 2 || 0;

    //TODO: useTonemapping hardcoded to false
    const useTonemapping = false;
    ctx.submit(drawCommand, {
      // viewport: camera.viewport,
      // scissor: camera.viewport,
      uniforms: {
        uProjectionMatrix: projectionMatrix,
        uViewMatrix: viewMatrix,
        // uModelMatrix: this.entity.transform.modelMatrix,
        //TODO: iplement entity matrix
        uModelMatrix: identityMatrix,
        uEnvMap: texture,
        uEnvMapEncoding: texture.encoding,
        uSourceSize: reflectionProbeMapSize,
        uOutputEncoding: outputEncoding,
        uBackgroundBlur: !renderingToReflectionProbe ? backgroundBlur : false,
        uUseTonemapping: !renderingToReflectionProbe ? useTonemapping : false,
        uExposure: !renderingToReflectionProbe ? exposure || 1 : 1, //TODO: hardcoded default from camera.exposure
      },
    });
  }

  const skyboxRenderSystem = {
    type: "skybox-renderer",
    renderStages: {
      background: (renderView, entities, options) => {
        const { camera } = renderView;
        const { renderingToReflectionProbe } = options;
        entities.forEach((e) => {
          if (e.skybox) {
            const reflectionProbeEntity = entities.find(
              (e) => e.reflectionProbe
            );
            draw(ctx, e.skybox, renderView.camera, {
              renderingToReflectionProbe: renderingToReflectionProbe,
              backgroundBlur: e.skybox.backgroundBlur,
              outputEncoding: renderView.outputEncoding || ctx.Encoding.Linear,
              reflectionProbeEntity,
            });
            // e._skybox.draw(renderView.camera, {
            //   backgroundMode: true,
            //   outputEncoding: ctx.Encoding.Linear,
            // });
            // ctx.submit(skyboxCmd, {
            //   attributes: e._geometry.attributes,
            //   indices: e._geometry.indices,
            //   uniforms: {
            //     uBaseColor: e.material.baseColor,
            //     uProjectionMatrix: camera.projectionMatrix,
            //     uViewMatrix: camera.viewMatrix,
            //     uModelMatrix: e._transform.modelMatrix,
            //   },
            // });
          }
        });
      },
    },
    update: () => {},
  };
  return skyboxRenderSystem;
}
