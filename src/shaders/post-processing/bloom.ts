import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/sky.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// Bloom's three shader stages: a bright-pass threshold, then a downsample
// pyramid, then an upsample chain blended back up it.

/** Brightness metric the threshold is scored against. */
const COLOR_FUNCTION = {
  COLOR_FUNCTION_LUMINANCE: "luminance",
  COLOR_FUNCTION_AVERAGE: "average",
} as const;

const colorFunction = (defines: Set<string>) => {
  for (const [define, name] of Object.entries(COLOR_FUNCTION)) {
    if (defines.has(define)) return name;
  }
  return "luma";
};

/**
 * Bright pass: everything above the threshold is what glares. Reading the
 * emissive target instead of the color one trades physicality for artistic
 * control — only what the artist marked emissive blooms, at any brightness.
 */
export const thresholdShader = (defines: Set<string> = new Set()): string => {
  const useSourceColor = defines.has("USE_SOURCE_COLOR");
  const useSourceEmissive = defines.has("USE_SOURCE_EMISSIVE");
  const useEmissiveTexture = defines.has("USE_EMISSIVE_TEXTURE");

  // Emissive is added on top unless the threshold ran on one specific source.
  const addEmissive = useEmissiveTexture && !useSourceColor && !useSourceEmissive;

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct Bloom {
  exposure: f32,
  threshold: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uBloom: Bloom;

${useSourceEmissive ? "" : textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${useSourceEmissive || addEmissive ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uEmissiveTexture") : ""}

${fullscreenVertex()}

// Fragment includes
${SHADERS.luma}
${SHADERS.luminance}
${SHADERS.average}
${SHADERS.threshold}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(
    ${useSourceEmissive ? "uEmissiveTexture, uEmissiveTextureSampler" : "uTexture, uTextureSampler"},
    input.texCoord0
  );
  color = vec4f(color.rgb * uBloom.exposure, color.a);

  color = threshold(color, ${colorFunction(defines)}(color.rgb), uBloom.threshold);

  ${addEmissive ? "color += textureSample(uEmissiveTexture, uEmissiveTextureSampler, input.texCoord0);" : ""}

  return color;
}
`);
};

/** One level of the bloom pyramid. */
export const downsampleShader = (defines: Set<string> = new Set()): string => {
  const alloc = createBindingAllocator(1);
  // The anti-flicker weighting costs four extra brightness reciprocals per
  // fragment, so the low quality path stays a plain box filter.
  const antiFlicker = !defines.has("QUALITY_0");

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct Downsample {
  intensity: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uDownsample: Downsample;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex({ corners: true })}

// Fragment includes
${SHADERS.math.max3}
${SHADERS.downsample}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return ${
    antiFlicker
      ? `downsampleBoxAntiFlicker(
    uTexture,
    uTextureSampler,
    input.texCoord0LeftUp,
    input.texCoord0RightUp,
    input.texCoord0LeftDown,
    input.texCoord0RightDown,
    uDownsample.intensity
  )`
      : `downsampleBox(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    input.texCoord0LeftUp,
    input.texCoord0RightUp,
    input.texCoord0LeftDown,
    input.texCoord0RightDown,
    uDownsample.intensity
  )`
  };
}
`);
};

/**
 * One level of the upsample chain, blended into the level above it. The 4-tap
 * filter samples half a texel out (bilinear taps land between texels); the tent
 * filter needs the full texel and the axis taps too.
 */
export const upsampleShader = (defines: Set<string> = new Set()): string => {
  const alloc = createBindingAllocator(1);
  const tent = !defines.has("QUALITY_0");

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex({ corners: true, axis: tent, offset: tent ? 1 : 0.5 })}

// Fragment includes
${SHADERS.upsample}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return ${
    tent
      ? `upsampleTent(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    input.texCoord0Down,
    input.texCoord0Up,
    input.texCoord0Left,
    input.texCoord0Right,
    input.texCoord0LeftUp,
    input.texCoord0RightUp,
    input.texCoord0LeftDown,
    input.texCoord0RightDown
  )`
      : `upsampleBilinear(
    uTexture,
    uTextureSampler,
    input.texCoord0LeftUp,
    input.texCoord0RightUp,
    input.texCoord0LeftDown,
    input.texCoord0RightDown
  )`
  };
}
`);
};
