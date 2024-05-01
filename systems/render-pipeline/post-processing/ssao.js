import random from "pex-random";
import { postProcessing as postprocessingShaders } from "pex-shaders";

import { BlueNoiseGenerator } from "../../../utils/blue-noise.js";

// prettier-ignore
export const ssaoMixFlagDefinitions = [
  [["options", "targets", "ssao.main"], "AO_TEXTURE", { type: "texture", uniform: "uSSAOTexture", requires: "USE_SSAO" }],
  [["postProcessing", "ssao", "mix"], "", { uniform: "uSSAOMix", requires: "USE_SSAO" }],
  [["postProcessing", "ssao", "type"], "USE_SSAO_GTAO", { compare: "gtao", requires: "USE_SSAO" }],
  [["postProcessing", "ssao", "colorBounce"], "USE_SSAO_COLORS", { requires: "USE_SSAO_GTAO" }],
]

function generateBlueNoiseTexture(ctx) {
  const generator = new BlueNoiseGenerator();
  generator.size = 32;

  const data = new Uint8Array(generator.size ** 2 * 4);
  for (let i = 0, l = 4; i < l; i++) {
    const result = generator.generate();
    const bin = result.data;
    const maxValue = result.maxValue;

    for (let j = 0, l2 = bin.length; j < l2; j++) {
      const value = 255 * (bin[j] / maxValue);
      data[j * 4 + i] = value;
    }
  }
  const blueNoiseTexture = ctx.texture2D({
    width: generator.size,
    height: generator.size,
    data: data,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.Linear,
    wrap: ctx.Wrap.Repeat,
    mag: ctx.Filter.Linear,
    min: ctx.Filter.Linear,
  });
  return blueNoiseTexture;
}

function generateNoiseTexture(ctx) {
  const localPRNG = random.create("0");

  const size = 64;
  const sizeSquared = size ** 2;
  const channelSize = ctx.gl.RG ? 2 : 4;
  const ssaoNoiseData = new Float32Array(sizeSquared * channelSize);
  for (let i = 0; i < sizeSquared; i++) {
    ssaoNoiseData[i * channelSize + 0] = localPRNG.float(-1, 1);
    ssaoNoiseData[i * channelSize + 1] = localPRNG.float(-1, 1);
    if (!ctx.gl.RG) {
      ssaoNoiseData[i * channelSize + 2] = 0;
      ssaoNoiseData[i * channelSize + 3] = 1;
    }
  }
  const noiseTexture = ctx.texture2D({
    width: size,
    height: size,
    data: ssaoNoiseData,
    pixelFormat: ctx.gl.RG ? ctx.PixelFormat.RG32F : ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    wrap: ctx.Wrap.Repeat,
    mag: ctx.Filter.Linear,
    min: ctx.Filter.Linear,
  });
  return noiseTexture;
}

const ssao = ({ ctx, resourceCache, descriptors, scale = 1 }) => {
  // GTAO
  const gtaoPass = {
    name: "main",
    frag: postprocessingShaders.gtao.frag,
    // blend: true,
    // prettier-ignore
    flagDefinitions: [
        [["camera", "near"], "", { uniform: "uNear" }],
        [["camera", "far"], "", { uniform: "uFar" }],
        [["camera", "fov"], "", { uniform: "uFov" }],

        [["postProcessing", "ssao"], "USE_SSAO"],

        [["postProcessing", "ssao", "type"], "USE_SSAO_GTAO", { compare: "gtao", requires: "USE_SSAO" }],
        [["postProcessing", "ssao", "slices"], "NUM_SLICES", { type: "value", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "intensity"], "", { uniform: "uIntensity", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "radius"], "", { uniform: "uRadius", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "brightness"], "", { uniform: "uBrightness", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "contrast"], "", { uniform: "uContrast", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "colorBounce"], "USE_COLOR_BOUNCE", { requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "colorBounceIntensity"], "", { uniform: "uColorBounceIntensity", requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "noiseTexture"], "USE_GTAO_NOISE_TEXTURE", { requires: "USE_SSAO_GTAO" }],
        [["postProcessing", "ssao", "_gtaoNoiseTexture"], "NOISE_TEXTURE", { type: "texture", uniform: "uNoiseTexture", requires: "USE_GTAO_NOISE_TEXTURE" }],
        [["postProcessing", "ssao", "_gtaoNoiseTexture", "width"], "", { uniform: "uNoiseTextureSize", requires: "USE_GTAO_NOISE_TEXTURE" }],
      ],
    enabled: ({ cameraEntity }) => {
      const isEnabled = cameraEntity.postProcessing.ssao.type === "gtao";

      if (
        isEnabled &&
        cameraEntity.postProcessing.ssao.noiseTexture &&
        !cameraEntity.postProcessing.ssao._gtaoNoiseTexture
      ) {
        cameraEntity.postProcessing.ssao._gtaoNoiseTexture =
          generateBlueNoiseTexture(ctx);
      }

      return isEnabled;
    },
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    target: ({ viewport }) => {
      const tex = resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        width: viewport[2] * scale,
        height: viewport[3] * scale,
      });
      return tex;
    },
    size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
  };

  // SAO
  const saoPass = {
    name: "main",
    frag: postprocessingShaders.sao.frag,
    // prettier-ignore
    flagDefinitions: [
        [["camera", "near"], "", { uniform: "uNear" }],
        [["camera", "far"], "", { uniform: "uFar" }],
        [["camera", "fov"], "", { uniform: "uFov" }],

        [["postProcessing", "ssao"], "USE_SSAO"],

        [["postProcessing", "ssao", "type"], "USE_SSAO_SAO", { compare: "sao", requires: "USE_SSAO" }],
        [["postProcessing", "ssao", "samples"], "NUM_SAMPLES", { type: "value", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "spiralTurns"], "NUM_SPIRAL_TURNS", { type: "value", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "intensity"], "", { uniform: "uIntensity", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "bias"], "", { uniform: "uBias", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "radius"], "", { uniform: "uRadius", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "brightness"], "", { uniform: "uBrightness", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "contrast"], "", { uniform: "uContrast", requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "noiseTexture"], "USE_SAO_NOISE_TEXTURE", { requires: "USE_SSAO_SAO" }],
        [["postProcessing", "ssao", "_saoNoiseTexture"], "NOISE_TEXTURE", { type: "texture", uniform: "uNoiseTexture", requires: "USE_SAO_NOISE_TEXTURE" }],
        [["postProcessing", "ssao", "_saoNoiseTexture", "width"], "", { uniform: "uNoiseTextureSize", requires: "USE_SAO_NOISE_TEXTURE" }],
      ],
    enabled: ({ cameraEntity }) => {
      const isEnabled = cameraEntity.postProcessing.ssao.type === "sao";

      if (
        isEnabled &&
        cameraEntity.postProcessing.ssao.noiseTexture &&
        !cameraEntity.postProcessing.ssao._saoNoiseTexture
      ) {
        cameraEntity.postProcessing.ssao._saoNoiseTexture =
          generateNoiseTexture(ctx);
      }

      return isEnabled;
    },
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    target: ({ viewport }) => {
      const tex = resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        pixelFormat: ctx.gl.RG ? ctx.PixelFormat.R8 : ctx.PixelFormat.RGBA8,
        width: viewport[2] * scale,
        height: viewport[3] * scale,
      });
      return tex;
    },
    size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
  };

  const blurHorizontalPass = {
    name: "blurHorizontal",
    frag: postprocessingShaders.bilateralBlur.frag,
    // prettier-ignore
    flagDefinitions: [
        [["camera", "near"], "", { uniform: "uNear" }],
        [["camera", "far"], "", { uniform: "uFar" }],
        [["postProcessing", "ssao", "blurSharpness"], "", { uniform: "uSharpness" }],
      ],
    enabled: ({ cameraEntity }) =>
      cameraEntity.postProcessing.ssao.blurRadius >= 0,
    uniforms: ({ cameraEntity: entity }) => ({
      uDirection: [entity.postProcessing.ssao.blurRadius, 0],
    }),
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: () => "ssao.main",
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        pixelFormat: ctx.PixelFormat.RGBA8,
        width: viewport[2] * scale,
        height: viewport[3] * scale,
      }),
    size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
  };

  const blurVerticalPass = {
    name: "blurVertical",
    frag: postprocessingShaders.bilateralBlur.frag,
    // prettier-ignore
    flagDefinitions: [
        [["camera", "near"], "", { uniform: "uNear" }],
        [["camera", "far"], "", { uniform: "uFar" }],
        [["postProcessing", "ssao", "blurSharpness"], "", { uniform: "uSharpness" }],
      ],
    enabled: ({ cameraEntity }) =>
      cameraEntity.postProcessing.ssao.blurRadius >= 0,
    uniforms: ({ cameraEntity: entity }) => ({
      uDirection: [0, entity.postProcessing.ssao.blurRadius],
    }),
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: () => "ssao.blurHorizontal",
    target: () => "ssao.main",
    size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
  };

  const mixPass = {
    name: "mix",
    frag: postprocessingShaders.ssaoMix.frag,
    // prettier-ignore
    flagDefinitions: [
      [["postProcessing", "ssao"], "USE_SSAO"],
      ...ssaoMixFlagDefinitions,
    ],
    // If no dof, disable and do it in final
    enabled: ({ cameraEntity }) => cameraEntity.postProcessing.dof,
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
  };

  return [gtaoPass, saoPass, blurHorizontalPass, blurVerticalPass, mixPass];
};

export default ssao;
