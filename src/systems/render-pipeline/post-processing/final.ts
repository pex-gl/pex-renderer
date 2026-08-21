import { finalShader, lumaShader } from "../../../shaders/post-processing/final.js";

import type {
  PostProcessingContext,
  PostProcessingEffect,
} from "../post-processing.js";

// FXAA's edge threshold pair per quality level, from the reference's presets:
// low, medium, high, ultra, extreme.
const FXAA_THRESHOLDS = [
  { min: 0.0833, max: 0.25 },
  { min: 0.0625, max: 0.166 },
  { min: 0.0312, max: 0.125 },
  { min: 0.0156, max: 0.063 },
  { min: 0.0078, max: 0.031 },
] as const;

const usesFXAA = ({ cameraEntity }: PostProcessingContext) =>
  !!cameraEntity.postProcessing!.fxaa;
const usesFilmGrain = ({ cameraEntity }: PostProcessingContext) =>
  !!cameraEntity.postProcessing!.filmGrain;

/** A fully opaque or fully transparent output needs no pass of its own. */
const usesOpacity = ({ cameraEntity }: PostProcessingContext) => {
  const { opacity } = cameraEntity.postProcessing!;
  return Number.isFinite(opacity) && opacity !== 0 && opacity !== 1;
};

const isEnabled = (context: PostProcessingContext) =>
  usesFXAA(context) || usesFilmGrain(context) || usesOpacity(context);

/**
 * The last stage: anti-aliasing, grain and output opacity, all of which want
 * the finished display-referred image.
 */
const final: PostProcessingEffect = {
  name: "final",
  srgb: true,
  passes: ({ cameraEntity }) => {
    const postProcessing = cameraEntity.postProcessing!;
    const fxaa = postProcessing.fxaa;
    const filmGrain = postProcessing.filmGrain;

    return [
      {
        name: "luma",
        shader: lumaShader,
        // Both consumers read luma per tap; computing it once is the point.
        enabled: (context) => usesFXAA(context) || usesFilmGrain(context),
        clearValue: [0, 0, 0, 1],
        format: () => "r8unorm",
      },
      {
        name: "main",
        shader: finalShader,
        chain: true,
        enabled: isEnabled,
        getDefines: (context) =>
          new Set([
            ...(usesFXAA(context) ? ["USE_FXAA"] : []),
            ...(usesFilmGrain(context) ? ["USE_FILM_GRAIN"] : []),
          ]),
        constants: () => {
          const edge = FXAA_THRESHOLDS[fxaa?.quality!] ?? FXAA_THRESHOLDS[2];
          return {
            ...(fxaa && {
              FXAA_EDGE_THRESHOLD_MIN: edge.min,
              FXAA_EDGE_THRESHOLD_MAX: edge.max,
            }),
            ...(filmGrain && { FILM_GRAIN_QUALITY: filmGrain.quality! }),
          };
        },
        clearValue: [0, 0, 0, 1],
        uniforms: ({ textures, samplers }) => ({
          uFinal: {
            subPixelQuality: fxaa?.subPixelQuality ?? 0,
            filmGrainSize: filmGrain?.size ?? 0,
            filmGrainIntensity: filmGrain?.intensity ?? 0,
            filmGrainColorIntensity: filmGrain?.colorIntensity ?? 0,
            filmGrainLuminanceIntensity: filmGrain?.luminanceIntensity ?? 0,
            filmGrainSpeed: filmGrain?.speed ?? 0,
            opacity: postProcessing.opacity ?? 1,
          },
          ...(textures.get("final.luma") && {
            uLumaTexture: textures.get("final.luma")!,
            uLumaTextureSampler: samplers.linear,
          }),
        }),
      },
    ];
  },
};

export default final;
