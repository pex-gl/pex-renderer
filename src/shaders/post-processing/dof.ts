import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/sky.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  fragmentOutputStruct,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// The passes the `depthOfField` chunk describes: optional autofocus, prefilter
// and its mip chain, tile reduction and dilation, one gather producing both
// fields, a post filter, and the composite.
//
// Each includes the chunk members it calls into and no more — the tile passes
// touch neither depth nor a circle of confusion, and the post filter needs only
// a luminance.
//
// Plumbing only — coordinates, loop bounds, attachments. What the numbers mean
// lives in the chunk.

const params = (alloc: ReturnType<typeof createBindingAllocator>) =>
  `@group(0) @binding(${alloc.next()}) var<uniform> uDoFParams: DepthOfFieldParams;`;

/**
 * Focus distance in millimetres, from the autofocus pass when there is one.
 *
 * That pass writes metres: half floats hold a scene's metres to a few
 * millimetres, and its millimetres only to the metre.
 */
const focusDistance = (fromScreenPoint: boolean) => /* wgsl */ `
fn dofFocus() -> f32 {
  ${
    fromScreenPoint
      ? `return textureSampleLevel(uFocusTexture, uFocusTextureSampler, vec2f(0.5), 0.0).r * 1000.0;`
      : `return uDoFParams.focusDistance;`
  }
}
`;

/**
 * Autofocus: one texel holding the distance the rest of the frame focuses at.
 *
 * Its own pass rather than extra taps in the two that need it, so the median is
 * taken once for the image instead of once per pixel.
 */
export const dofFocusShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.depthRead}
${SHADERS.depthOfField.common}
${SHADERS.depthOfField.depth}
${SHADERS.depthOfField.focus}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // mm -> m
  return vec4f(dofFocusDistance(uDepthTexture, uDepthTextureSampler, uDoFParams) / 1000.0, 0.0, 0.0, 1.0);
}
`);
};

/** Half-resolution colour and signed circle of confusion, with the boost baked in. */
export const dofPrefilterShader = (
  defines: Set<string> = new Set(),
): string => {
  const resolved = defines.has("USE_DOF_RESOLVED_COC");
  const fromScreenPoint = !resolved && defines.has("USE_FOCUS_ON_SCREEN_POINT");
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.saturate}
${SHADERS.luma}
${SHADERS.threshold}
${SHADERS.depthRead}
${SHADERS.depthOfField.common}
${SHADERS.depthOfField.depth}
${SHADERS.depthOfField.coc}
${SHADERS.depthOfField.downsample}
${SHADERS.depthOfField.prefilter}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${
  resolved
    ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uCoCTexture")
    : textureSamplerDeclaration(
        0,
        alloc.nextTextureSampler(),
        "uDepthTexture",
        "texture_depth_2d",
      )
}
${fromScreenPoint ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uFocusTexture") : ""}

${resolved ? "" : focusDistance(fromScreenPoint)}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  ${
    resolved
      ? `let quad = dofCoCQuadFromTexture(uCoCTexture, uCoCTextureSampler, input.texCoord0, uDoFParams);`
      : `let quad = dofCoCQuadFromDepth(uDepthTexture, uDepthTextureSampler, input.texCoord0, dofFocus(), uDoFParams);`
  }

  return dofPrefilter(uTexture, uTextureSampler, input.texCoord0, quad, uDoFParams);
}
`);
};

/**
 * One level of the prefilter's mip chain.
 *
 * Binds the level below through a view rather than a uniform: this writes level
 * N of the texture it samples level N-1 of, and a handle may not be read and
 * written by one pass. The view carries the level's size, so the taps step in
 * its texels without being told which level they are on.
 */
export const dofDownsampleShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.saturate}
${SHADERS.depthOfField.downsample}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return dofDownsample(uTexture, uTextureSampler, input.texCoord0);
}
`);
};

/**
 * First half of the tile reduction: the largest near and far radius in each row
 * of a tile.
 *
 * Separable, like the motion blur tiles: one pass of tileSize² reads per tile
 * would leave most of the machine idle.
 */
export const dofTileMaxXShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.depthOfField.tiles}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let base = i32(input.position.x) * DOF_TILE_SIZE;
  let row = f32(i32(input.position.y)) + 0.5;

  var tile = vec2f(0.0);

  for (var i: i32 = 0; i < DOF_TILE_SIZE; i++) {
    let uv = vec2f(f32(base + i) + 0.5, row) * uPostProcessing.sourceTexelSize;
    tile = max(tile, dofTileCoC(textureSampleLevel(uTexture, uTextureSampler, uv, 0.0).a));
  }

  return vec4f(tile, 0.0, 1.0);
}
`);
};

/** Second half: the largest of those rows, giving one pair per tile. */
export const dofTileMaxYShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.depthOfField.tiles}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let column = f32(i32(input.position.x)) + 0.5;
  let base = i32(input.position.y) * DOF_TILE_SIZE;

  var tile = vec2f(0.0);

  for (var i: i32 = 0; i < DOF_TILE_SIZE; i++) {
    let uv = vec2f(column, f32(base + i) + 0.5) * uPostProcessing.sourceTexelSize;
    tile = max(tile, textureSampleLevel(uTexture, uTextureSampler, uv, 0.0).rg);
  }

  return vec4f(tile, 0.0, 1.0);
}
`);
};

/**
 * The largest radius that can reach each tile, taken from every tile whose
 * bokeh could span the gap.
 *
 * The test is circular rather than square: a square would hand the gather a
 * radius nothing in the corner tiles could actually span, spending sample
 * density on empty area.
 */
export const dofTileDilateShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.depthOfField.tiles}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var tile = vec2f(0.0);
  let limit = DOF_TILE_DILATE_RADIUS * DOF_TILE_DILATE_RADIUS;

  for (var y: i32 = -DOF_TILE_DILATE_RADIUS; y <= DOF_TILE_DILATE_RADIUS; y++) {
    for (var x: i32 = -DOF_TILE_DILATE_RADIUS; x <= DOF_TILE_DILATE_RADIUS; x++) {
      if (x * x + y * y > limit) {
        continue;
      }

      let uv = input.texCoord0 + vec2f(f32(x), f32(y)) * uPostProcessing.sourceTexelSize;
      tile = max(tile, textureSampleLevel(uTexture, uTextureSampler, uv, 0.0).rg);
    }
  }

  return vec4f(tile, 0.0, 1.0);
}
`);
};

/**
 * The gather: both fields, from one set of taps, at half resolution.
 *
 * Two attachments because the fields composite differently — the far one by the
 * destination's own defocus, the near one by its own coverage — and one image
 * cannot carry both.
 */
export const dofGatherShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}
${SHADERS.math.saturate}
${SHADERS.depthOfField.common}
${SHADERS.depthOfField.gather}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTileTexture")}

${fullscreenVertex()}

${fragmentOutputStruct([{ name: "near", type: "vec4f" }])}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  // Interpolated, not point sampled. A tile holds a maximum, so blending two
  // looks like it could report less than one of them asked for — but the
  // dilation already widened every tile to cover a superset of what any pixel
  // inside it needs, and a blend of two such values stays above the larger's
  // true requirement. Point sampling would quantise the near field's gather
  // radius to the tile grid, a visible step in blur along every tile border.
  let tile = textureSampleLevel(uTileTexture, uTileTextureSampler, input.texCoord0, 0.0).rg;

  let fields = dofGather(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    input.position.xy,
    tile,
    uDoFParams
  );

  var output: FragmentOutput;
  output.color = fields.far;
  output.near = fields.near;
  return output;
}
`);
};

/**
 * The post filter, which is a different filter per field.
 *
 * The far field takes four bilinear taps half a texel out, a 3x3 tent for four
 * samples: what removes the ring structure a modest sample budget leaves
 * behind. Correct on it because a defocused background is smooth by
 * construction, so there is nothing an average destroys.
 *
 * The near field takes nine and a median instead. What it has to remove is not
 * ring structure but speckle — see `dofFilterNear` — and a tent spreads a speck
 * rather than rejecting it.
 */
export const dofPostFilterShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.luma}
${SHADERS.depthOfField.postFilter}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNearTexture")}

${fullscreenVertex({ corners: true, offset: 0.5 })}

${fragmentOutputStruct([{ name: "near", type: "vec4f" }])}

fn dofTent(tex: texture_2d<f32>, texSampler: sampler, input: VertexOutput) -> vec4f {
  return 0.25 * (
    textureSampleLevel(tex, texSampler, input.texCoord0LeftUp, 0.0)
    + textureSampleLevel(tex, texSampler, input.texCoord0RightUp, 0.0)
    + textureSampleLevel(tex, texSampler, input.texCoord0LeftDown, 0.0)
    + textureSampleLevel(tex, texSampler, input.texCoord0RightDown, 0.0)
  );
}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = dofTent(uTexture, uTextureSampler, input);
  // Point sampled, so the nine taps are nine texels: a bilinear read would
  // average the speck back in before the median could reject it.
  output.near = dofFilterNear(
    uNearTexture,
    uNearTextureSampler,
    input.texCoord0,
    uPostProcessing.sourceTexelSize
  );
  return output;
}
`);
};

/**
 * The circle of confusion, accumulated over the jitter sequence.
 *
 * Declared before the prefilter, so the prefilter, the tile chain derived from
 * it and the composite all read one stable value. Resolving it at the composite
 * alone leaves the stages that amplify the jitter reading the raw one.
 *
 * Reuses the `taa` chunk's reprojection: where a surface was last frame is the
 * same question whatever is being accumulated.
 */
export const dofCoCResolveShader = (
  defines: Set<string> = new Set(),
): string => {
  const fromScreenPoint = defines.has("USE_FOCUS_ON_SCREEN_POINT");
  const useVelocity = defines.has("USE_DOF_COC_VELOCITY");
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.depthRead}
${SHADERS.depthOfField.common}
${SHADERS.depthOfField.depth}
${SHADERS.depthOfField.coc}
${SHADERS.depthOfField.resolve}
${SHADERS.luminance}
${SHADERS.taa}

${params(alloc)}
@group(0) @binding(${alloc.next()}) var<uniform> uTAA: TAAParams;
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uHistoryTexture")}
${useVelocity ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture") : ""}
${fromScreenPoint ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uFocusTexture") : ""}

${focusDistance(fromScreenPoint)}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let uv = input.texCoord0;
  let focus = dofFocus();

  let current = dofCoC(
    dofDepth(uDepthTexture, uDepthTextureSampler, uv, uDoFParams),
    focus,
    uDoFParams
  );
  let range = dofCoCRange(uDepthTexture, uDepthTextureSampler, uv, focus, uDoFParams);

  ${
    useVelocity
      ? `// Dilated to the closest depth, so a silhouette carries the motion of the
  // surface in front rather than of the background showing past it.
  let closest = taaClosestDepthOffset(uDepthTexture, uDepthTextureSampler, uv + uTAA.depthOffset, uTAA.texelSize);
  let previousUV = taaVelocityUV(uVelocityTexture, uVelocityTextureSampler, uv, closest.xy + uTAA.depthOffset);
  let reprojected = 1.0;`
      : `// Camera reprojection only: exact for a static scene, and it drags anything
  // that moved on its own.
  let depthNDC = textureSampleLevel(uDepthTexture, uDepthTextureSampler, uv + uTAA.depthOffset, 0);
  let reprojection = taaReprojectUV(uv, depthNDC, uTAA);
  let previousUV = reprojection.xy;
  let reprojected = reprojection.z;`
  }

  // Off screen last frame, so there is none of this surface to continue from.
  let onScreen = f32(all(previousUV >= vec2f(0.0)) && all(previousUV <= vec2f(1.0)));
  let history = textureSampleLevel(uHistoryTexture, uHistoryTextureSampler, previousUV, 0.0).r;

  let coc = dofResolveCoC(
    current,
    range,
    history,
    uTAA.historyValid * onScreen * reprojected,
    uTAA.blendFactor
  );

  return vec4f(coc, 0.0, 0.0, 1.0);
}
`);
};

/**
 * Back to full resolution: the sharp image, its own transition blur, the far
 * field, then the near field over all three.
 *
 * The circle of confusion is full resolution rather than read back from the
 * prefilter: a half-resolution radius cannot say which side of a silhouette a
 * full-resolution pixel is on.
 */
export const dofCompositeShader = (
  defines: Set<string> = new Set(),
): string => {
  const resolved = defines.has("USE_DOF_RESOLVED_COC");
  const fromScreenPoint = !resolved && defines.has("USE_FOCUS_ON_SCREEN_POINT");
  const debug = defines.has("USE_DOF_DEBUG");
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}
${SHADERS.math.saturate}
${SHADERS.depthRead}
${SHADERS.depthOfField.common}
${SHADERS.depthOfField.depth}
${SHADERS.depthOfField.coc}
${SHADERS.depthOfField.composite}

${params(alloc)}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${
  resolved
    ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uCoCTexture")
    : textureSamplerDeclaration(
        0,
        alloc.nextTextureSampler(),
        "uDepthTexture",
        "texture_depth_2d",
      )
}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uFarTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uNearTexture")}
${fromScreenPoint ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uFocusTexture") : ""}
${debug ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTileTexture") : ""}

${resolved ? "" : focusDistance(fromScreenPoint)}

${fullscreenVertex()}

${debug ? fragmentOutputStruct([{ name: "debug", type: "vec4f" }]) : ""}

@fragment
fn fragmentMain(input: VertexOutput) -> ${debug ? "FragmentOutput" : "@location(0) vec4f"} {
  ${
    resolved
      ? `let coc = textureSampleLevel(uCoCTexture, uCoCTextureSampler, input.texCoord0, 0.0).r;`
      : `let coc = dofCoC(dofDepth(uDepthTexture, uDepthTextureSampler, input.texCoord0, uDoFParams), dofFocus(), uDoFParams);`
  }

  let composited = dofComposite(
    uTexture,
    uTextureSampler,
    uFarTexture,
    uFarTextureSampler,
    uNearTexture,
    uNearTextureSampler,
    input.texCoord0,
    coc,
    uDoFParams
  );
${
  debug
    ? `
  // Its own attachment rather than in place of the image: everything after this
  // still applies exposure and a tone map, so a visualization written into the
  // chain would arrive display-encoded and could not be read as a number.
  let tile = textureSampleLevel(uTileTexture, uTileTextureSampler, input.texCoord0, 0.0).rg;

  var output: FragmentOutput;
  output.color = composited;
  output.debug = vec4f(dofDebug(coc, tile, uDoFParams), 1.0);
  return output;`
    : `
  return composited;`
}
}
`);
};
