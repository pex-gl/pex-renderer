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

  const basicRendererSystem = {
    renderStages: {
      background: (renderView, entities) => {
        const { camera } = renderView;
        entities.forEach((e) => {
          if (e.skybox) {
            e._skybox.draw(renderView.camera, {
              backgroundMode: false,
              outputEncoding: ctx.Encoding.Linear,
            });
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
