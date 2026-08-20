import {
  downsampleShader,
  thresholdShader,
  upsampleShader,
} from "../../../shaders/post-processing/bloom.js";

import type {
  PostProcessingEffect,
  PostProcessingSubPass,
} from "../post-processing.js";

// TODO(dmnsgn): derive the level count from the viewport size instead.
const LEVELS = 9;

// Every level is upsampled straight back into the full-resolution threshold
// target and accumulated there, so the blend is additive, not "over".
const ADDITIVE: GPUBlendState = {
  color: { srcFactor: "one", dstFactor: "one" },
  alpha: { srcFactor: "one", dstFactor: "one" },
};

const COLOR_FUNCTION_DEFINE: Record<string, string> = {
  luminance: "COLOR_FUNCTION_LUMINANCE",
  average: "COLOR_FUNCTION_AVERAGE",
};

const levelSize = (viewport: number[], level: number) => [
  viewport[2]! / 2 ** (level + 1),
  viewport[3]! / 2 ** (level + 1),
];

/**
 * Bloom: threshold the bright pixels, build a downsample pyramid, then add
 * every level back at full resolution. The result stays on the blackboard as
 * `bloom.threshold` for combine to add into the tonemapped image.
 */
const bloom: PostProcessingEffect = {
  name: "bloom",
  passes: ({ cameraEntity }) => {
    const postProcessing = cameraEntity.postProcessing!;
    const component = postProcessing.bloom!;

    // 0 is the plain box filter, 1 the anti-flicker/tent pair.
    const quality: Set<string> =
      component.quality === 0 ? new Set(["QUALITY_0"]) : new Set();

    const threshold: PostProcessingSubPass = {
      name: "threshold",
      shader: thresholdShader,
      getDefines: ({ emissive }) =>
        new Set([
          ...(emissive ? ["USE_EMISSIVE_TEXTURE"] : []),
          ...(component.source === "color" ? ["USE_SOURCE_COLOR"] : []),
          ...(component.source === "emissive" && emissive
            ? ["USE_SOURCE_EMISSIVE"]
            : []),
          ...(COLOR_FUNCTION_DEFINE[component.colorFunction!]
            ? [COLOR_FUNCTION_DEFINE[component.colorFunction!]!]
            : []),
        ]),
      uniforms: ({ emissive, samplers }) => ({
        uBloom: {
          exposure: postProcessing.exposure!,
          threshold: component.threshold!,
        },
        ...(emissive && {
          uEmissiveTexture: emissive,
          uEmissiveTextureSampler: samplers.linear,
        }),
      }),
    };

    const downsample: PostProcessingSubPass[] = Array.from(
      { length: LEVELS },
      (_, level) => ({
        name: `downsample[${level}]`,
        shader: downsampleShader,
        getDefines: () => quality,
        source: () =>
          level === 0 ? "bloom.threshold" : `bloom.downsample[${level - 1}]`,
        size: ({ viewport }) => levelSize(viewport, level),
        uniforms: () => ({ uDownsample: { intensity: component.radius! } }),
      }),
    );

    const upsample: PostProcessingSubPass[] = Array.from(
      { length: LEVELS - 1 },
      (_, level) => ({
        name: `main[${level}]`,
        shader: upsampleShader,
        getDefines: () => quality,
        blend: ADDITIVE,
        source: () => `bloom.downsample[${level + 1}]`,
        target: () => "bloom.threshold",
      }),
    );

    return [threshold, ...downsample, ...upsample];
  },
};

export default bloom;
