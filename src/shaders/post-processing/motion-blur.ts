import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/taa.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// Motion blur in the tile framework of McGuire et al. 2012 with the
// reconstruction filter of Guertin et al. 2014: reduce the velocity buffer to a
// grid of dominant motions, widen each tile to include the motions that could
// reach it, then gather along those motions per pixel.
//
// Four passes rather than three: the tile reduction is separable, and doing it
// in one pass would put tileSize² texture reads in a single invocation where
// two passes of tileSize each keep the machine busy.

/**
 * The tile grid's cell size, in pixels — also the longest motion the filter can
 * represent, since the neighbourhood pass reaches exactly one tile out.
 *
 * A pipeline constant rather than a uniform because it bounds the reduction
 * loops, and a setting nobody changes per frame.
 */
const TILE_SIZE = "override MOTION_BLUR_TILE_SIZE: i32 = 40;";

/** The uniform block all four passes bind. */
const params = (alloc: ReturnType<typeof createBindingAllocator>) =>
  `@group(0) @binding(${alloc.next()}) var<uniform> uMotionBlur: MotionBlurParams;`;

/**
 * First half of the tile reduction: the largest motion in each row of a tile.
 *
 * Reads the raw velocity buffer, so this is also where frame motion becomes the
 * pixels-per-shutter the rest of the filter measures in — every later pass
 * reads tiles that already hold it.
 */
export const motionBlurTileMaxXShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.saturate}
${SHADERS.depthRead}
${SHADERS.motionBlur}

${TILE_SIZE}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let base = i32(input.position.x) * MOTION_BLUR_TILE_SIZE;
  let row = f32(i32(input.position.y)) + 0.5;

  var result = vec2f(0.0);
  var longest = 0.0;

  for (var i: i32 = 0; i < MOTION_BLUR_TILE_SIZE; i++) {
    let uv = vec2f(f32(base + i) + 0.5, row) * uPostProcessing.sourceTexelSize;
    let v = motionBlurVelocity(uTexture, uTextureSampler, uv, uMotionBlur);
    let magnitude = length(v);

    if (magnitude > longest) {
      longest = magnitude;
      result = v;
    }
  }

  return vec4f(result, 0.0, 1.0);
}
`);
};

/** Second half: the largest of those rows, giving one motion per tile. */
export const motionBlurTileMaxYShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${TILE_SIZE}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let column = f32(i32(input.position.x)) + 0.5;
  let base = i32(input.position.y) * MOTION_BLUR_TILE_SIZE;

  var result = vec2f(0.0);
  var longest = 0.0;

  for (var i: i32 = 0; i < MOTION_BLUR_TILE_SIZE; i++) {
    let uv = vec2f(column, f32(base + i) + 0.5) * uPostProcessing.sourceTexelSize;
    let v = textureSampleLevel(uTexture, uTextureSampler, uv, 0.0).xy;
    let magnitude = length(v);

    if (magnitude > longest) {
      longest = magnitude;
      result = v;
    }
  }

  return vec4f(result, 0.0, 1.0);
}
`);
};

/**
 * The largest motion that could reach each tile, taken from its neighbours.
 *
 * This is what lets something moving fast blur past its own silhouette: a pixel
 * gathers along the motion of whatever is about to cross it, not just its own.
 */
export const motionBlurNeighborMaxShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.saturate}
${SHADERS.depthRead}
${SHADERS.motionBlur}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return vec4f(
    motionBlurNeighborMax(
      uTexture,
      uTextureSampler,
      input.texCoord0,
      uPostProcessing.sourceTexelSize
    ),
    0.0,
    1.0
  );
}
`);
};

/** The reconstruction itself. */
export const motionBlurShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.saturate}
${SHADERS.depthRead}
${SHADERS.motionBlur}

${params(alloc)}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNeighborMaxTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let color = motionBlurReconstruct(
    input.texCoord0,
    vec2u(input.position.xy),
    uTexture,
    uTextureSampler,
    uVelocityTexture,
    uVelocityTextureSampler,
    uNeighborMaxTexture,
    uNeighborMaxTextureSampler,
    uDepthTexture,
    uDepthTextureSampler,
    uMotionBlur
  );

  return vec4f(color, 1.0);
}
`);
};
