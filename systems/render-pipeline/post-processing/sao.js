import { postProcessing } from "pex-shaders";
import random from "pex-random";

function createSAONoisePixelData(ctx) {
  const size = 64;
  const localPRNG = random.create("0");

  const sizeSquared = size ** 2;
  const channelSize = ctx.gl.RG ? 2 : 4;
  const saoNoiseData = new Float32Array(sizeSquared * channelSize);
  for (let i = 0; i < sizeSquared; i++) {
    saoNoiseData[i * channelSize + 0] = localPRNG.float(-1, 1);
    saoNoiseData[i * channelSize + 1] = localPRNG.float(-1, 1);
    if (!ctx.gl.RG) {
      saoNoiseData[i * channelSize + 2] = 0;
      saoNoiseData[i * channelSize + 3] = 1;
    }
  }
  return {
    width: size,
    height: size,
    data: saoNoiseData,
  };
}

const sao = ({
  ctx,
  resourceCache,
  descriptors,
  scale = 1,
  saoMainTarget,
  gtaoMainTarget,
}) => ({
  name: "main",
  frag: postProcessing.sao.frag,
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
  saoNoiseTextureDesc: {
    name: "saoNoiseTextureDesc",
    pixelFormat: ctx.gl.RG ? ctx.PixelFormat.RG32F : ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    wrap: ctx.Wrap.Repeat,
    mag: ctx.Filter.Linear,
    min: ctx.Filter.Linear,
    ...createSAONoisePixelData(ctx),
  },
  disabled: ({ cameraEntity }) => {
    const isEnabled = cameraEntity.postProcessing.ssao.type === "sao";

    if (
      isEnabled &&
      cameraEntity.postProcessing.ssao.noiseTexture &&
      !cameraEntity.postProcessing.ssao._saoNoiseTexture
    ) {
      const saoNoisePixelData = createSAONoisePixelData(ctx);

      cameraEntity.postProcessing.ssao._saoNoiseTexture = ctx.texture2D({
        width: saoNoisePixelData.width,
        height: saoNoisePixelData.height,
        data: saoNoisePixelData.data,
        pixelFormat: ctx.gl.RG
          ? ctx.PixelFormat.RG32F
          : ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear,
        wrap: ctx.Wrap.Repeat,
        mag: ctx.Filter.Linear,
        min: ctx.Filter.Linear,
      });
    }

    return !isEnabled;
  },
  passDesc: () => ({
    clearColor: [0, 0, 0, 1],
  }),
  target: ({ viewport }) => {
    if (!saoMainTarget) {
      saoMainTarget = ctx.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        // pixelFormat: ctx.PixelFormat.RGBA8,
        pixelFormat: ctx.gl.RG ? ctx.PixelFormat.R8 : ctx.PixelFormat.RGBA8,
        width: viewport[2] * scale,
        height: viewport[3] * scale,
      });
    } else {
      ctx.update(saoMainTarget, {
        width: viewport[2] * scale,
        height: viewport[3] * scale,
      });
    }
    return saoMainTarget;
  },
  size: ({ viewport }) => [viewport[2] * scale, viewport[3] * scale],
});

export default sao;
