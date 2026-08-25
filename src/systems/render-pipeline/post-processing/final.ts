import {
  finalShader,
  lumaShader,
} from "../../../shaders/post-processing/final.js";

import type { PostProcessingEffect } from "../post-processing.js";

// FXAA's edge threshold pair per quality level, from the reference's presets:
// low, medium, high, ultra, extreme.
const FXAA_THRESHOLDS = [
  { min: 0.0833, max: 0.25 },
  { min: 0.0625, max: 0.166 },
  { min: 0.0312, max: 0.125 },
  { min: 0.0156, max: 0.063 },
  { min: 0.0078, max: 0.031 },
] as const;

/**
 * The last stage: anti-aliasing, grain and output opacity, all of which want
 * the finished display-referred image.
 */
const final: PostProcessingEffect = {
  name: "final",
  srgb: true,
  declare({ cameraEntity, samplers, pass }) {
    const postProcessing = cameraEntity.postProcessing!;
    const { fxaa, filmGrain, opacity } = postProcessing;

    // Only a fully opaque output needs no pass: the chain leaves alpha at 1, so
    // every other value — 0 included — has to be written by something.
    const usesOpacity = Number.isFinite(opacity) && opacity !== 1;
    if (!fxaa && !filmGrain && !usesOpacity) return;

    // Both consumers read luma per tap; computing it once is the point.
    const luma =
      fxaa || filmGrain
        ? pass({
            name: "luma",
            shader: lumaShader,
            clearValue: [0, 0, 0, 1],
            format: "r8unorm",
          })
        : undefined;

    const edge = FXAA_THRESHOLDS[fxaa?.quality!] ?? FXAA_THRESHOLDS[2];

    pass({
      name: "main",
      shader: finalShader,
      chain: true,
      defines: new Set([
        ...(fxaa ? ["USE_FXAA"] : []),
        ...(filmGrain ? ["USE_FILM_GRAIN"] : []),
      ]),
      constants: {
        ...(fxaa && {
          FXAA_EDGE_THRESHOLD_MIN: edge.min,
          FXAA_EDGE_THRESHOLD_MAX: edge.max,
        }),
        ...(filmGrain && { FILM_GRAIN_QUALITY: filmGrain.quality! }),
      },
      clearValue: [0, 0, 0, 1],
      uniforms: {
        uFinal: {
          subPixelQuality: fxaa?.subPixelQuality ?? 0,
          filmGrainSize: filmGrain?.size ?? 0,
          filmGrainIntensity: filmGrain?.intensity ?? 0,
          filmGrainColorIntensity: filmGrain?.colorIntensity ?? 0,
          filmGrainLuminanceIntensity: filmGrain?.luminanceIntensity ?? 0,
          filmGrainSpeed: filmGrain?.speed ?? 0,
          opacity: opacity ?? 1,
        },
        ...(luma && {
          uLumaTexture: luma,
          uLumaTextureSampler: samplers.linear,
        }),
      },
    });
  },
};

export default final;
