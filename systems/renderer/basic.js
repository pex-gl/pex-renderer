export default function createBasicRendererSystem(opts) {
  const { ctx } = opts;

  const basicCmd = {
    name: "basicCmd",
    pipeline: ctx.pipeline({
      vert: /*glsl*/ `
      attribute vec3 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
      `,
      frag: /*glsl*/ `
      precision highp float;
      uniform vec4 uBaseColor;
      void main() {
        gl_FragData[0] = uBaseColor;
      }
      `,
      depthWrite: true,
      depthTest: true,
    }),
  };

  const transparentCmd = {
    name: "basicCmd",
    pipeline: ctx.pipeline({
      vert: /*glsl*/ `
      attribute vec3 aPosition;
      uniform mat4 uProjectionMatrix;
      uniform mat4 uViewMatrix;
      uniform mat4 uModelMatrix;
      void main() {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      }
      `,
      frag: /*glsl*/ `
      precision highp float;
      uniform vec4 uBaseColor;
      void main() {
        gl_FragData[0] = uBaseColor;
      }
      `,
      depthWrite: false,
      depthTest: true,
      blend: true,
      blendSrcRGBFactor: ctx.BlendFactor.One,
      blendSrcAlphaFactor: ctx.BlendFactor.One,
      blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    }),
  };

  const basicRendererSystem = {
    renderStages: {
      opaque: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (
            e.geometry &&
            e.material &&
            !e.material?.blend &&
            !e.drawSegments
          ) {
            ctx.submit(basicCmd, {
              attributes: e._geometry.attributes,
              indices: e._geometry.indices,
              uniforms: {
                uBaseColor: e.material.baseColor,
                uProjectionMatrix: camera.projectionMatrix,
                uViewMatrix: camera.viewMatrix,
                uModelMatrix: e._transform.modelMatrix,
              },
            });
          }
        });
      },
      transparent: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.geometry && e.material && e.material?.blend) {
            ctx.submit(transparentCmd, {
              attributes: e._geometry.attributes,
              indices: e._geometry.indices,
              uniforms: {
                uBaseColor: e.material.baseColor,
                uProjectionMatrix: camera.projectionMatrix,
                uViewMatrix: camera.viewMatrix,
                uModelMatrix: e._transform.modelMatrix,
              },
            });
          }
        });
      },
    },
    update: () => {},
  };
  return basicRendererSystem;
}
