function createPassDescriptors(ctx) {
  const passes = {
    directionalLightShadows: {
      colorMapDesc: {
        name: "directionalLightColorMap", //TODO: is it used?
        width: 2048,
        height: 2048,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      },
      shadowMapDesc: {
        name: "directionalLightShadowMap", //TODO: is it used?
        width: 2048,
        height: 2048,
        pixelFormat: ctx.PixelFormat.Depth,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Nearest,
      },
      pass: {
        name: "DirectionalLight.shadowMap",
        color: [],
        depth: null,
        clearColor: [0, 0, 0, 1],
        clearDepth: 1,
      },
    },
    mainPass: {
      outputTextureDesc: {
        width: 1,
        height: 1,
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      },
      outputDepthTextureDesc: {
        width: 1,
        height: 1,
        pixelFormat: ctx.PixelFormat.Depth,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Nearest,
      },
      pass: {
        color: [],
      },
    },
    tonemap: {
      pipelineDesc: {
        vert: /*glsl*/ `
          attribute vec2 aPosition;
          void main () {
            gl_Position = vec4(aPosition, 0.0, 1.0);
          }
          `,
        frag: /*glsl*/ `
          precision highp float;
          uniform vec4 uViewport;
          uniform sampler2D uTexture;

          vec3 tonemapAces( vec3 x ) {
              float tA = 2.5;
              float tB = 0.03;
              float tC = 2.43;
              float tD = 0.59;
              float tE = 0.14;
              return clamp((x*(tA*x+tB))/(x*(tC*x+tD)+tE),0.0,1.0);
          }

          void main () {
            vec2 vUV = vec2((gl_FragCoord.x - uViewport.x) / uViewport.z, (gl_FragCoord.y - uViewport.y) / uViewport.w);
            gl_FragColor = vec4(vUV, 0.0, 1.0);
            vec4 color = texture2D(uTexture, vUV);
            color.rgb *= 0.5;
            color.rgb = tonemapAces(color.rgb);
            color.rgb = pow(color.rgb, vec3(1.0 / 2.2)); //to gamma
            gl_FragColor = color;
          }
          `,
      },
      pass: {
        color: [],
        clearColor: [0, 0, 0, 1],
      },
    },
  };
  return passes;
}

export default createPassDescriptors;
