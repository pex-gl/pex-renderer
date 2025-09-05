import { pipeline as SHADERS } from "pex-shaders";
import { CUBEMAP_SIDES } from "../../utils.js";

export default (ctx) => ({
  directionalLightShadows: {
    colorMapDesc: {
      name: "directionalLightColorMap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.RGBA8,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
    shadowMapDesc: {
      name: "directionalLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT24,
      min: ctx.Filter.Nearest,
      mag: ctx.Filter.Nearest,
    },
    pass: {
      name: "directionalLightShadowMappingPass",
      color: [],
      depth: null,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1,
    },
  },
  spotLightShadows: {
    colorMapDesc: {
      name: "spotLightColorMap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.RGBA8,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
    shadowMapDesc: {
      name: "spotLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT24,
      min: ctx.Filter.Nearest,
      mag: ctx.Filter.Nearest,
    },
    pass: {
      name: "spotLightShadowMappingPass",
      color: [],
      depth: null,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1,
    },
  },
  pointLightShadows: {
    colorMapDesc: {
      name: "pointLightShadowCubemap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.RGBA8,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
    shadowMapDesc: {
      name: "pointLightShadowMap",
      width: 2048,
      height: 2048,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT24,
      min: ctx.Filter.Nearest,
      mag: ctx.Filter.Nearest,
    },
    cubemapSides: structuredClone(CUBEMAP_SIDES),
    passes: CUBEMAP_SIDES.map((side, i) => ({
      name: `pointLightShadowMappingSide${i}`,
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
      name: "mainPassColorTexture",
      width: 1,
      height: 1,
      pixelFormat: ctx.PixelFormat.RGBA16F,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
    outputDepthTextureDesc: {
      name: "mainPassDepthTexture",
      width: 1,
      height: 1,
      pixelFormat: ctx.PixelFormat.DEPTH_COMPONENT24,
      min: ctx.Filter.Nearest,
      mag: ctx.Filter.Nearest,
    },
    pass: {
      color: [],
    },
  },
  grabPass: {
    colorCopyTextureDesc: {
      name: "grabPassColorCopyTexture",
      width: 1,
      height: 1,
      pixelFormat: ctx.PixelFormat.RGBA16F,
      min: ctx.Filter.LinearMipmapLinear,
      // min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
      mipmap: true,
    },
    copyTexturePipelineDesc: {
      vert: SHADERS.blit.vert,
      frag: /* glsl */ `
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
}`,
    },
  },
  postProcessing: {
    outputTextureDesc: {
      pixelFormat: ctx.capabilities.textureHalfFloat
        ? ctx.PixelFormat.RGBA16F
        : ctx.PixelFormat.RGBA8,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
    finalTextureDesc: {
      pixelFormat: ctx.capabilities.sRGB
        ? ctx.PixelFormat.SRGB8_ALPHA8
        : ctx.PixelFormat.RGBA8,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear,
    },
  },
  blit: {
    pipelineDesc: {
      vert: SHADERS.blit.vert,
      frag: SHADERS.blit.frag,
    },
  },
});
