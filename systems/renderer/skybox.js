import { skybox } from "pex-shaders";
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

  const drawCommand = {
    name: "Skybox.draw",
    pipeline: ctx.pipeline({
      vert: ctx.capabilities.isWebGL2
        ? patchVS(skybox.skybox.vert)
        : /* glsl */ `
          ${DRAW_BUFFERS_EXT}
          ${skybox.skybox.vert}`,
      frag: ctx.capabilities.isWebGL2
        ? patchFS(skybox.skybox.frag)
        : /* glsl */ `
          ${DRAW_BUFFERS_EXT}
          ${skybox.skybox.frag}`,
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
    const { backgroundMode, outputEncoding, backgroundBlur } = opts;
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

    // let texture = skybox.texture || skybox._skyTexture;
    // let backgroundBlur = 0;
    // if (backgroundMode) {
    //   if (this.backgroundTexture) {
    //     texture = this.backgroundTexture;
    //   }

    //   if (this.backgroundBlur > 0) {
    //     backgroundBlur = this.backgroundBlur;
    //     //TODO: skybox-system and reflection-probe-system peer dependency
    //     // if (!this._reflectionProbe) {
    //     // this._reflectionProbe =
    //     // this.entity.renderer.getComponents("ReflectionProbe")[0];
    //     // }
    //     if (this._reflectionProbe) {
    //       texture = this._reflectionProbe._reflectionMap;
    //     }
    //   }
    // }

    //TODO: useTonemapping hardcoded to false
    // const postProcessingCmp = entity
    // ? entity.getComponent("PostProcessing")
    // : null;
    // const useTonemapping = !(postProcessingCmp && postProcessingCmp.enabled);
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
        uOutputEncoding: outputEncoding,
        uBackgroundBlur: backgroundBlur,
        uUseTonemapping: backgroundMode ? useTonemapping : false,
        uExposure: backgroundMode ? exposure || 1 : 1, //TODO: hardcoded default from camera.exposure
      },
    });
  }

  const basicRendererSystem = {
    renderStages: {
      background: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.skybox) {
            draw(ctx, e.skybox, renderView.camera, {
              backgroundMode: true,
              backgroundBlur: false,
              outputEncoding: renderView.outputEncoding || ctx.Encoding.Linear,
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
  return basicRendererSystem;
}
