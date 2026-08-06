// @ts-nocheck
import { postProcessing as postprocessingShaders } from "pex-shaders";
import { isSMAAEnabled } from "./smaa.js";

export const isFXAAEnabled = ({ cameraEntity }) =>
  cameraEntity.postProcessing.fxaa;
export const isFilmGrainEnabled = ({ cameraEntity }) =>
  cameraEntity.postProcessing.filmGrain;

export const isFinalMainEnabled = ({ cameraEntity }) =>
  isFXAAEnabled({ cameraEntity }) ||
  isFilmGrainEnabled({ cameraEntity }) ||
  (Number.isFinite(cameraEntity.postProcessing.opacity) &&
    cameraEntity.postProcessing.opacity !== 0 &&
    cameraEntity.postProcessing.opacity !== 1);

const final = ({ ctx, resourceCache, descriptors }) => {
  const lumaPass = {
    name: "luma",
    frag: postprocessingShaders.luma.frag,
    flagDefinitions: [],
    enabled: (options) => isFXAAEnabled(options) || isFilmGrainEnabled(options),
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: (options) =>
      isSMAAEnabled(options) ? "smaa.blend" : "combine.main",
    target: ({ viewport }) =>
      resourceCache.texture2D({
        ...descriptors.postProcessing.outputTextureDesc,
        pixelFormat: ctx.gl.RG ? ctx.PixelFormat.R8 : ctx.PixelFormat.RGBA8,
        width: viewport[2],
        height: viewport[3],
      }),
  };

  const finalPass = {
    name: "main",
    frag: postprocessingShaders.final.frag,
    // blend: true,
    // prettier-ignore
    flagDefinitions: [
      // AA
      [["postProcessing", "fxaa"], "USE_FXAA"],
      [["postProcessing", "fxaa", "subPixelQuality"], "", { uniform: "uSubPixelQuality", requires: "USE_FXAA" }],
      [["postProcessing", "fxaa", "quality"], "AA_QUALITY", { type: "value", requires: "USE_FXAA" }],

      // Film Grain
      [["postProcessing", "filmGrain"], "USE_FILM_GRAIN"],
      [["postProcessing", "filmGrain", "quality"], "FILM_GRAIN_QUALITY", { type: "value", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "size"], "", { uniform: "uFilmGrainSize", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "intensity"], "", { uniform: "uFilmGrainIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "colorIntensity"], "", { uniform: "uFilmGrainColorIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "luminanceIntensity"], "", { uniform: "uFilmGrainLuminanceIntensity", requires: "USE_FILM_GRAIN" }],
      [["postProcessing", "filmGrain", "speed"], "", { uniform: "uFilmGrainSpeed", requires: "USE_FILM_GRAIN" }],

      [["options", "targets", "final.luma"], "LUMA_TEXTURE", { type: "texture", uniform: "uLumaTexture", requires: "USE_FXAA" }],
      [["options", "targets", "final.luma"], "LUMA_TEXTURE", { type: "texture", uniform: "uLumaTexture", requires: "USE_FILM_GRAIN", excludes: "USE_FXAA" }],

      // Output
      [["postProcessing", "opacity"], "", { uniform: "uOpacity" }],
    ],
    enabled: isFinalMainEnabled,
    passDesc: () => ({
      clearColor: [0, 0, 0, 1],
    }),
    source: (options) =>
      isSMAAEnabled(options) ? "smaa.blend" : "combine.main",
  };

  return [lumaPass, finalPass];
};

export default final;
