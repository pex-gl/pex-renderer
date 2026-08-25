import {
  downsampleShader,
  thresholdShader,
  upsampleShader,
} from "../../../shaders/post-processing/bloom.js";

import type {
  PostProcessingEffect,
  PostProcessingSubPass,
} from "../post-processing.js";

/**
 * Halving stops once the next level would be smaller than this. Below a few
 * texels a level is a draw call that contributes nothing, and the bilinear taps
 * have no neighbours left to gather.
 */
const MIN_LEVEL_SIZE = 8;

/**
 * Past this the blur already covers the screen, so another level buys nothing
 * visible. Only a 4K viewport has the texels to reach it.
 */
const MAX_LEVELS = 9;

// Each level is added into the level above it, so the blend is additive, not
// "over".
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
 * How many levels the viewport has texels for, unless the component asks for a
 * specific count.
 *
 * A fixed count is wrong in both directions: it leaves a 4K viewport blurring
 * over a fraction of the screen, and it gives a small one levels of 2×1 whose
 * only effect is a draw call. Asking for one explicitly is still useful — the
 * level count is what sets the largest glare radius, so it is an artistic
 * control as much as a budget.
 */
const levelCount = (viewport: number[], requested?: number) => {
  const fits = Math.floor(
    Math.log2(Math.min(viewport[2]!, viewport[3]!) / MIN_LEVEL_SIZE),
  );
  return Math.max(1, Math.min(requested ?? MAX_LEVELS, fits));
};

/**
 * Bloom: threshold the bright pixels, build a downsample pyramid, then add
 * every level back at full resolution. The result stays in the register as
 * `bloom.threshold` for combine to add into the tonemapped image.
 */
const bloom: PostProcessingEffect = {
  name: "bloom",
  // Optional: the threshold pass falls back to the color chain without it.
  outputs: ["emissive"],
  passes: ({ cameraEntity, viewport }) => {
    const postProcessing = cameraEntity.postProcessing!;
    const component = postProcessing.bloom!;

    // 0 is the plain box filter, 1 the anti-flicker/tent pair.
    const quality: Set<string> =
      component.quality === 0 ? new Set(["QUALITY_0"]) : new Set();

    const levels = levelCount(viewport, component.levels);

    const threshold: PostProcessingSubPass = {
      name: "threshold",
      shader: thresholdShader,
      getDefines: ({ textures }) =>
        new Set([
          ...(textures.get("emissive") ? ["USE_EMISSIVE_TEXTURE"] : []),
          ...(component.source === "color" ? ["USE_SOURCE_COLOR"] : []),
          ...(component.source === "emissive" && textures.get("emissive")
            ? ["USE_SOURCE_EMISSIVE"]
            : []),
          ...(COLOR_FUNCTION_DEFINE[component.colorFunction!]
            ? [COLOR_FUNCTION_DEFINE[component.colorFunction!]!]
            : []),
        ]),
      uniforms: ({ textures, samplers }) => ({
        uBloom: {
          exposure: postProcessing.exposure!,
          threshold: component.threshold!,
        },
        ...(textures.get("emissive") && {
          uEmissiveTexture: textures.get("emissive")!,
          uEmissiveTextureSampler: samplers.linear,
        }),
      }),
    };

    const downsample: PostProcessingSubPass[] = Array.from(
      { length: levels },
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

    /**
     * Back up the pyramid, smallest first: each level is added into the one
     * above it *at that level's size*, so the sum accumulates as it climbs and
     * only the last draw is full resolution.
     *
     * Adding every level straight into the full-resolution target instead costs
     * one full-screen draw per level — and asks a nine-tap tent to bridge a
     * gap of up to 2^n texels, which no filter kernel can do.
     */
    const upsample: PostProcessingSubPass[] = Array.from(
      { length: levels },
      (_, index) => {
        const level = levels - 1 - index;
        return {
          name: `upsample[${level}]`,
          shader: upsampleShader,
          getDefines: () => quality,
          blend: ADDITIVE,
          source: () => `bloom.downsample[${level}]`,
          target: () =>
            level === 0 ? "bloom.threshold" : `bloom.downsample[${level - 1}]`,
        };
      },
    );

    return [threshold, ...downsample, ...upsample];
  },
};

export default bloom;
