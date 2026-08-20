import { chunks as SHADERS } from "pex-shaders";

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// The last pass: the effects that want the finished, display-referred image —
// FXAA and film grain — plus the output opacity.

// Both chunks read luma from a single-channel texture rather than recomputing
// it per tap, which is what makes FXAA's edge search affordable.
const READ_LUMA_TEXTURE = /* wgsl */ `
fn readLumaTexture(tex: texture_2d<f32>, texSampler: sampler, uv: vec2f) -> f32 {
  return textureSampleLevel(tex, texSampler, uv, 0.0).r;
}
`;

/** Precomputes luma into a single channel for the FXAA and film grain passes. */
export const lumaShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

// Fragment includes
${SHADERS.luma}
${SHADERS.encodeDecode}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let color = textureSample(uTexture, uTextureSampler, input.texCoord0);

  return vec4f(luma(encode(color, SRGB).rgb), 0.0, 0.0, 1.0);
}
`);
};

/** Anti-aliasing, grain and output opacity. */
export const finalShader = (defines: Set<string> = new Set()): string => {
  const useFXAA = defines.has("USE_FXAA");
  const useFilmGrain = defines.has("USE_FILM_GRAIN");
  const useLumaTexture = useFXAA || useFilmGrain;

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct Final {
  subPixelQuality: f32,
  filmGrainSize: f32,
  filmGrainIntensity: f32,
  filmGrainColorIntensity: f32,
  filmGrainLuminanceIntensity: f32,
  filmGrainSpeed: f32,
  opacity: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uFinal: Final;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${useLumaTexture ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uLumaTexture") : ""}

${fullscreenVertex({ corners: useFXAA, axis: useFXAA })}

// Fragment includes
${SHADERS.math.saturate}
${SHADERS.encodeDecode}
${useLumaTexture ? READ_LUMA_TEXTURE : ""}
${useFXAA ? SHADERS.fxaa : ""}
${
  useFilmGrain
    ? `// 0 random, 1 large (Lottes), 2 Upitis periodic simplex noise.
override FILM_GRAIN_QUALITY: i32 = 2;
${SHADERS.math.glslMod}
${SHADERS.noise.common}
${SHADERS.noise.perlin}
${SHADERS.math.random}
${SHADERS.filmGrain}`
    : ""
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  ${
    useFXAA
      ? `let uv = fxaa(
    uLumaTexture,
    uLumaTextureSampler,
    input.texCoord0,
    input.texCoord0LeftUp,
    input.texCoord0RightUp,
    input.texCoord0LeftDown,
    input.texCoord0RightDown,
    input.texCoord0Down,
    input.texCoord0Up,
    input.texCoord0Left,
    input.texCoord0Right,
    uPostProcessing.texelSize,
    uFinal.subPixelQuality
  );`
      : "let uv = input.texCoord0;"
  }

  var colorSRGB = encode(textureSample(uTexture, uTextureSampler, uv), SRGB);

  ${
    useFilmGrain
      ? `colorSRGB = vec4f(
    filmGrain(
      colorSRGB.rgb,
      readLumaTexture(uLumaTexture, uLumaTextureSampler, input.texCoord0),
      uv,
      uPostProcessing.viewportSize,
      uFinal.filmGrainSize,
      uFinal.filmGrainIntensity,
      uFinal.filmGrainColorIntensity,
      uFinal.filmGrainLuminanceIntensity,
      floor(uPostProcessing.time * uFinal.filmGrainSpeed * 60.0)
    ),
    colorSRGB.a
  );`
      : ""
  }

  let color = decode(colorSRGB, SRGB);

  return vec4f(color.rgb, color.a * uFinal.opacity);
}
`);
};
