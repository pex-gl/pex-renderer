import {
  downsampleShader,
  thresholdShader,
  upsampleShader,
} from "../../../shaders/post-processing/bloom.js";

import type { ResourceHandle } from "../../../frame-graph/index.js";
import type { PostProcessingEffect } from "../post-processing.js";

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

/**
 * Level 0 is a quarter of the viewport: the bright pass already spent the first
 * halving, and the pyramid starts below it.
 *
 * Kino's arrangement, and the reason this is not a full-resolution pyramid: the
 * glare is a wide low-frequency image, so the top octave costs the most and
 * contributes the least.
 */
const levelSize = (viewport: number[], level: number) => [
  viewport[2]! / 2 ** (level + 2),
  viewport[3]! / 2 ** (level + 2),
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
  // One less than the halvings the viewport has, since the bright pass already
  // spent the first.
  const fits =
    Math.floor(
      Math.log2(Math.min(viewport[2]!, viewport[3]!) / MIN_LEVEL_SIZE),
    ) - 1;
  return Math.max(1, Math.min(requested ?? MAX_LEVELS, fits));
};

/**
 * Bloom: threshold the bright pixels at half resolution, build a downsample
 * pyramid below that, then add every level back up it. The sum ends in
 * `bloom.threshold` for combine to add into the tonemapped image, sampled
 * bilinearly — which is the chain's last upsample.
 */
const bloom: PostProcessingEffect = {
  name: "bloom",
  // Optional: the threshold pass falls back to the color chain without it.
  outputs: ["emissive"],
  declare({ cameraEntity, viewport, textures, samplers, pass }) {
    const postProcessing = cameraEntity.postProcessing!;
    const component = postProcessing.bloom!;

    // 0 is the plain box filter, 1 the anti-flicker/tent pair.
    const quality: Set<string> =
      component.quality === 0 ? new Set(["QUALITY_0"]) : new Set();

    const levels = levelCount(viewport, component.levels);
    const emissive = textures.get("emissive");
    const fromEmissive = component.source === "emissive" && !!emissive;

    const threshold = pass({
      name: "threshold",
      shader: thresholdShader,
      size: [viewport[2]! / 2, viewport[3]! / 2],
      // Reading the emissive target instead of the color one trades physicality
      // for artistic control: only what the artist marked emissive blooms.
      ...(fromEmissive && { source: null }),
      defines: new Set([
        ...(emissive ? ["USE_EMISSIVE_TEXTURE"] : []),
        ...(component.source === "color" ? ["USE_SOURCE_COLOR"] : []),
        ...(fromEmissive ? ["USE_SOURCE_EMISSIVE"] : []),
        ...(COLOR_FUNCTION_DEFINE[component.colorFunction!]
          ? [COLOR_FUNCTION_DEFINE[component.colorFunction!]!]
          : []),
      ]),
      uniforms: {
        uBloom: {
          exposure: postProcessing.exposure!,
          threshold: component.threshold!,
          // Half-width of the ramp into the glare, as a fraction of the
          // threshold. Content sitting at the threshold is the case it exists
          // for: without it, anything that moves such a pixel by a few percent
          // — a temporal resolve's residual, a thin line's coverage, a motion
          // blur streak — swings the whole cutoff.
          softKnee: component.softKnee ?? 0.5,
        },
        ...(emissive && {
          uEmissiveTexture: emissive,
          uEmissiveTextureSampler: samplers.linear,
        }),
      },
    });

    const pyramid: ResourceHandle[] = [];
    let source = threshold;
    for (let level = 0; level < levels; level++) {
      source = pass({
        name: `downsample[${level}]`,
        shader: downsampleShader,
        defines: quality,
        source,
        size: levelSize(viewport, level),
        uniforms: { uDownsample: { intensity: component.radius! } },
      });
      pyramid.push(source);
    }

    /**
     * Back up the pyramid, smallest first: each level is added into the one
     * above it *at that level's size*, so the sum accumulates as it climbs and
     * the last draw is the half-resolution bright pass. Combine's bilinear read
     * takes it the rest of the way.
     *
     * Adding every level straight into one target instead costs a draw at that
     * size per level — and asks a nine-tap tent to bridge a gap of up to 2^n
     * texels, which no filter kernel can do.
     */
    for (let level = levels - 1; level >= 0; level--) {
      pass({
        name: `upsample[${level}]`,
        shader: upsampleShader,
        defines: quality,
        blend: ADDITIVE,
        source: pyramid[level]!,
        target: level === 0 ? threshold : pyramid[level - 1]!,
      });
    }
  },
};

export default bloom;
