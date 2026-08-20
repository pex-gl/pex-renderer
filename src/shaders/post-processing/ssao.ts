import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/sky.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { FRAGMENT_COORD, fullscreenVertex, postProcessingStruct } from "./common.js";

// Screen-space ambient occlusion: two interchangeable estimators (GTAO, SAO)
// writing a visibility buffer, a depth-aware blur to clean it up, and the mix
// back into the color chain.
//
// Both estimators sample the depth and normal targets at pixel centres, so they
// take a fragment coordinate rather than a texture coordinate.

/**
 * Ground Truth Ambient Occlusion. Writes visibility in `.x`, or the bounced
 * indirect color in `.rgb` with visibility in `.a` when color bounce is on —
 * the mix pass reads whichever the same override selects.
 */
export const gtaoShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

// Includes lead: the gtao chunk declares GTAOParams, the type bound below.
${SHADERS.math.PI}
${SHADERS.math.HALF_PI}
${SHADERS.math.saturate}
${SHADERS.colorCorrection}
${SHADERS.depthRead}
${SHADERS.depthPosition}
${SHADERS.gtao}

@group(0) @binding(${alloc.next()}) var<uniform> uGTAO: GTAOParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNormalTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNoiseTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var colorBounce = vec3f(0.0);
  let visibility = gtao(
    uTexture,
    uTextureSampler,
    uDepthTexture,
    uDepthTextureSampler,
    uNormalTexture,
    uNormalTextureSampler,
    uNoiseTexture,
    uNoiseTextureSampler,
    ${FRAGMENT_COORD},
    uGTAO,
    &colorBounce
  );

  if (USE_GTAO_COLOR_BOUNCE) {
    return vec4f(colorBounce, visibility);
  }
  return vec4f(visibility, 0.0, 0.0, 1.0);
}
`);
};

/** Scalable Ambient Obscurance. Writes visibility in `.x`. */
export const saoShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

// Includes lead: the sao chunk declares SAOParams, the type bound below.
${SHADERS.math.TWO_PI}
${SHADERS.math.saturate}
${SHADERS.math.random}
${SHADERS.colorCorrection}
${SHADERS.depthRead}
${SHADERS.depthPosition}
${SHADERS.sao}

@group(0) @binding(${alloc.next()}) var<uniform> uSAO: SAOParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNormalTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNoiseTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let visibility = sao(
    uDepthTexture,
    uDepthTextureSampler,
    uNormalTexture,
    uNormalTextureSampler,
    uNoiseTexture,
    uNoiseTextureSampler,
    ${FRAGMENT_COORD},
    uSAO
  );

  return vec4f(visibility, 0.0, 0.0, 1.0);
}
`);
};

/**
 * One separable pass of the depth-aware blur that removes the estimators'
 * sampling noise without bleeding occlusion across silhouettes.
 */
export const bilateralBlurShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct BilateralBlur {
  direction: vec2f,
  near: f32,
  far: f32,
  sharpness: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uBlur: BilateralBlur;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

// Fragment includes
${SHADERS.depthRead}
${SHADERS.blur}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return bilateralBlur(
    uTexture,
    uTextureSampler,
    uDepthTexture,
    uDepthTextureSampler,
    input.texCoord0,
    uBlur.direction,
    uPostProcessing.viewportSize,
    uBlur.near,
    uBlur.far,
    uBlur.sharpness
  );
}
`);
};

/**
 * Applies the visibility buffer to the color chain. Only declared when DoF
 * follows — otherwise combine does the same mix, saving a fullscreen pass.
 */
export const ssaoMixShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct SSAO {
  mix: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uSSAO: SSAO;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uSSAOTexture")}

${fullscreenVertex()}

// Fragment includes
// Reads the estimator's bounced color instead of visibility alone.
override USE_SSAO_COLORS: bool = false;
${SHADERS.ambientOcclusion.multiBounce}
${SHADERS.ambientOcclusion.mix}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return ssao(
    textureSample(uTexture, uTextureSampler, input.texCoord0),
    textureSample(uSSAOTexture, uSSAOTextureSampler, input.texCoord0),
    uSSAO.mix
  );
}
`);
};
