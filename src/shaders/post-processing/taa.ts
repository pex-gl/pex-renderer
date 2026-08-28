import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/ssao.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

/**
 * Contrast-adaptive sharpening over the resolved image.
 *
 * A separate pass, and deliberately not folded into the resolve: what it writes
 * must never reach the history. Sharpening an image that is then sharpened
 * again next frame compounds without bound, and the accumulator has to keep the
 * clean version for that reason.
 */
export const taaSharpenShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.max3}
${SHADERS.luminance}
${SHADERS.taa}
${SHADERS.sharpen}

struct TAASharpen {
  sharpness: f32,
}
@group(0) @binding(${alloc.next()}) var<uniform> uSharpen: TAASharpen;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex({ axis: true })}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let center = textureSampleLevel(uTexture, uTextureSampler, input.texCoord0, 0.0);

  // RCAS limits against the range [0, 1], and this runs on the linear HDR image
  // — the resolve is what softened it, so this is where the softening has to be
  // undone, before bloom and the tonemap see it. The same reversible curve the
  // resolve blends in brings the taps into that range and takes the result back
  // out.
  let up = taaTonemap(textureSampleLevel(uTexture, uTextureSampler, input.texCoord0Up, 0.0).rgb);
  let left = taaTonemap(textureSampleLevel(uTexture, uTextureSampler, input.texCoord0Left, 0.0).rgb);
  let middle = taaTonemap(center.rgb);
  let right = taaTonemap(textureSampleLevel(uTexture, uTextureSampler, input.texCoord0Right, 0.0).rgb);
  let down = taaTonemap(textureSampleLevel(uTexture, uTextureSampler, input.texCoord0Down, 0.0).rgb);

  let sharpened = rcas(up, left, middle, right, down, uSharpen.sharpness);

  return vec4f(max(vec3f(0.0), taaTonemapInverse(sharpened)), center.a);
}
`);
};

/**
 * This frame's linear view depth, recorded for the next frame's disocclusion
 * test.
 *
 * Its own pass rather than a second target on the resolve, so one texture can
 * serve both directions: declared after the resolve, the write-after-read edge
 * lets the resolve read what the last frame left before this overwrites it. A
 * second output would have had to alternate between two.
 */
export const taaDepthHistoryShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.luminance}
${SHADERS.taa}

@group(0) @binding(${alloc.next()}) var<uniform> uTAA: TAAParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) f32 {
  let depth = textureSampleLevel(uDepthTexture, uDepthTextureSampler, input.texCoord0, 0);

  // Against this frame's view, which is what the next frame will call previous.
  let ndc = vec3f(input.texCoord0.x * 2.0 - 1.0, 1.0 - input.texCoord0.y * 2.0, depth);
  var world = uTAA.inverseViewProjectionMatrix * vec4f(ndc, 1.0);

  return 1.0 / world.w;
}
`);
};

/**
 * Temporal antialiasing resolve: one pass blending this frame into the
 * accumulated history.
 *
 * Runs on the linear HDR image, before bloom and the tonemap. Anything after it
 * sees a stable image, which is the point — bloom applied to a jittered frame
 * would carry the jitter into its pyramid, and neighbourhood statistics
 * gathered after a tonemap describe the display-referred image rather than the
 * one being accumulated.
 *
 * `uTexture` is the chain's current image, bound by the registry.
 */
export const taaShader = (defines: Set<string> = new Set()): string => {
  const alloc = createBindingAllocator(1);
  const velocity = defines.has("USE_TAA_VELOCITY");
  const disocclusion = defines.has("USE_TAA_DISOCCLUSION");

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.luminance}
${SHADERS.taa}

@group(0) @binding(${alloc.next()}) var<uniform> uTAA: TAAParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uHistoryTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}
${velocity ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture") : ""}
${disocclusion ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uPreviousDepthTexture") : ""}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.texCoord0;

  // Dilated either way: at a silhouette the pixel centre can sit on background
  // while the edge that moved belongs to the foreground.
  let closest = taaClosestDepthOffset(uDepthTexture, uDepthTextureSampler, uv, uTAA.texelSize);

  ${
    velocity
      ? `let previousUV = taaVelocityUV(uVelocityTexture, uVelocityTextureSampler, uv, closest.xy);
  let reprojectionValid = true;`
      : `// No motion vectors, so only camera motion can be recovered — correct for
  // a static scene and wrong for anything that moved on its own.
  let reprojected = taaReprojectUV(uv + closest.xy, closest.z, uTAA);
  let previousUV = uv + (reprojected.xy - (uv + closest.xy));
  let reprojectionValid = reprojected.z > 0.5;`
  }

  ${
    disocclusion
      ? `// This pixel's own depth, not the dilated neighbour's: the dilation is
  // there to make a silhouette follow the foreground's motion, and the
  // question here is whether the history belongs to the surface being shaded.
  let centerDepth = textureSampleLevel(uDepthTexture, uDepthTextureSampler, uv, 0);
  let expectedDepth = taaPreviousViewDepth(uv, centerDepth, uTAA);
  // Derivatives before any branching, so they stay in uniform control flow.
  let depthSlope = fwidth(expectedDepth);
  let sameSurface = !taaDisoccluded(
    uPreviousDepthTexture,
    uPreviousDepthTextureSampler,
    previousUV,
    expectedDepth,
    depthSlope,
    uTAA
  );`
      : "let sameSurface = true;"
  }

  return taaResolve(
    uv,
    previousUV,
    reprojectionValid && sameSurface,
    uTexture,
    uTextureSampler,
    uHistoryTexture,
    uHistoryTextureSampler,
    uTAA
  );
}
`);
};
