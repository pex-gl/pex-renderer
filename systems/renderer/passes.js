import { mat4 } from "pex-math";

//prettier-ignore
const cubemapSides = [
  { eye: [0, 0.0, 0], target: [1, 0, 0], up: [0, -1, 0], color: [1, 0, 0, 1] },
  { eye: [0, 0.0, 0], target: [-1, 0, 0], up: [0, -1, 0], color: [0.5, 0, 0, 1], },
  { eye: [0, 0.0, 0], target: [0, 1, 0], up: [0, 0, 1], color: [0, 1, 0, 1] },
  { eye: [0, 0.0, 0], target: [0, -1, 0], up: [0, 0, -1],color: [0, 0.5, 0, 1], },
  { eye: [0, 0.0, 0], target: [0, 0, 1], up: [0, -1, 0], color: [0, 0, 1, 1] },
  { eye: [0, 0.0, 0], target: [0, 0, -1], up: [0, -1, 0], color: [0, 0, 0.5, 1], },
].map((side, i) => {
  side.projectionMatrix = mat4.perspective(
    mat4.create(),
    Math.PI / 2,
    1,
    0.1,
    100
  ); // TODO: change this to radians
  // side.viewMatrix = mat4.lookAt(mat4.create(), side.eye, side.target, side.up);
  // side.drawPassCmd = {
  //   name: "PointLight.sidePass",
  //   pass: ctx.pass({
  //     name: "PointLight.sidePass",
  //     depth: this._shadowMap,
  //     color: [
  //       {
  //         texture: this._shadowCubemap,
  //         target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
  //       },
  //     ],
  //     clearColor: [Math.random(), Math.random(), Math.random(), 1],
  //     clearDepth: 1,
  //   }),
  // };
  return side;
});

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
    pointLightShadows: {
      shadowCubemapDesc: {
        name: "pointLightShadowCubemap", //TODO: is it used?
        width: 512,
        height: 512,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
      },
      shadowMapDesc: {
        name: "pointLightShadowMap", //TODO: is it used?
        width: 512,
        height: 512,
        pixelFormat: ctx.PixelFormat.Depth,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.Nearest,
        mag: ctx.Filter.Nearest,
      },
      cubemapSides,
      passes: cubemapSides.map((side, i) => ({
        name: `PointLight.shadowMap_side_${i}`,
        color: [
          {
            target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
          },
        ],
        depth: null,
        clearColor: side.color,
        clearDepth: 1,
      })),
    },
    mainPass: {
      outputTextureDesc: {
        width: 1,
        height: 1,
        pixelFormat: ctx.PixelFormat.RGBA16F,
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
    grabPass: {
      colorCopyTextureDesc: {
        width: 1,
        height: 1,
        pixelFormat: ctx.PixelFormat.RGBA16F,
        encoding: ctx.Encoding.Linear,
        min: ctx.Filter.LinearMipmapLinear,
        // min: ctx.Filter.Linear,
        mag: ctx.Filter.Linear,
        mipmap: true,
      },
      copyTexturePipelineDesc: {
        vert: /*glsl*/ `
        attribute vec2 aPosition;
        varying vec2 vTexCoord0;
        void main () {
          gl_Position = vec4(aPosition, 0.0, 1.0);
          vTexCoord0 = aPosition.xy * 0.5 + 0.5;
        }
        `,
        frag: /*glsl*/ `
          precision highp float;
          uniform vec4 uViewport;
          uniform sampler2D uTexture;
          varying vec2 vTexCoord0;
          void main() {
            gl_FragColor = texture2D(uTexture, vTexCoord0);
            // gl_FragColor.rgb = vec3(
            //   max(
            //     max(gl_FragColor.r, gl_FragColor.g),
            //     gl_FragColor.b)
            // );
          }
        `,
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
