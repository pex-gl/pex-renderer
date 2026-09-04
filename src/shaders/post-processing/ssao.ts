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
import {
  FRAGMENT_COORD,
  fullscreenVertex,
  postProcessingStruct,
} from "./common.js";

// Screen-space ambient occlusion: two interchangeable estimators writing a
// visibility buffer, the filter each needs to clean it up, and the mix back into
// the color chain.
//
// GTAO is three passes — a compute prefilter over depth, the estimator, and an
// edge-aware denoiser — where SAO is one plus a separable bilateral blur. Both
// estimators read the depth and normal targets at pixel centres, so they take a
// fragment coordinate rather than a texture coordinate.

/**
 * Levels of the depth pyramid, matching the chunk's hand-unrolled reduction and
 * GTAO's `GTAO_DEPTH_MIP_MAX_LEVEL`. Four rather than the reference's five: a
 * storage texture view is a single mip, and WebGPU only guarantees four storage
 * texture bindings per stage.
 */
export const DEPTH_MIP_LEVELS = 4;

/**
 * Depth prefilter: the compute pass that turns the depth buffer into the linear
 * view-space pyramid both estimators sample, in one dispatch.
 *
 * Not a fullscreen pass, and not because compute is faster per se: the coarser
 * levels reduce through workgroup memory, so building them costs one read of
 * the depth buffer rather than one full pass over the previous level each.
 *
 * Both estimators bind the pyramid's own small params struct rather than their
 * own: the reduction needs four scalars, and which filter runs is a constant.
 */
export const depthPyramidShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.saturate}
${SHADERS.depthRead}
${SHADERS.depthPyramid}

@group(0) @binding(${alloc.next()}) var<uniform> uDepthPyramid: DepthPyramidParams;
@group(0) @binding(${alloc.next()}) var uDepthTexture: texture_depth_2d;
${Array.from(
  { length: DEPTH_MIP_LEVELS },
  (_, level) =>
    `@group(0) @binding(${alloc.next()}) var uDepthMip${level}: texture_storage_2d<r32uint, write>;`,
).join("\n")}

// Each thread covers a 2x2 block, so a workgroup covers 16x16 pixels.
@compute @workgroup_size(8, 8, 1)
fn computeMain(
  @builtin(global_invocation_id) globalId: vec3u,
  @builtin(local_invocation_id) localId: vec3u
) {
  depthPyramidBuild16x16(
    globalId.xy,
    localId.xy,
    uDepthTexture,
    uDepthPyramid,
    uDepthMip0,
    uDepthMip1,
    uDepthMip2,
    uDepthMip3
  );
}
`);
};

/**
 * Ground Truth Ambient Occlusion. Writes visibility in `.x` — plus the bent
 * normal in `.yzw` under `USE_GTAO_BENT_NORMALS` — and, when a denoise pass
 * follows, the edge weights it needs at `@location(1)`.
 */
export const gtaoShader = (defines: Set<string>): string => {
  const alloc = createBindingAllocator(1);
  const edges = defines.has("USE_GTAO_EDGES");

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.PI}
${SHADERS.math.HALF_PI}
${SHADERS.math.saturate}
${SHADERS.colorCorrection}
${SHADERS.depthRead}
${SHADERS.depthPyramid}
${SHADERS.gtao.common}
${SHADERS.gtao.main}

// The last denoise pass restores the UNORM scale; with no denoise pass to do
// it, the estimator applies it itself.
override GTAO_FINAL_APPLY: bool = true;

@group(0) @binding(${alloc.next()}) var<uniform> uGTAO: GTAOParams;
@group(0) @binding(${alloc.next()}) var uDepthTexture: texture_2d<u32>;
@group(0) @binding(${alloc.next()}) var uNormalTexture: texture_2d<f32>;

${fullscreenVertex()}

${fragmentOutputStruct([edges && { name: "edges", type: "vec4f" }])}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;

  let term = gtaoMainPass(vec2i(${FRAGMENT_COORD}), uDepthTexture, uNormalTexture, uGTAO);

  output.color = gtaoEncodeVisibilityBentNormal(term, GTAO_FINAL_APPLY);
  ${edges ? "output.edges = term.edgesLRTB;" : ""}

  return output;
}
`);
};

/**
 * One edge-aware denoise pass over the visibility buffer. Both textures are
 * read by texel rather than sampled: the filter is a 3x3 stencil on its own
 * grid, so there is nothing for a sampler to interpolate.
 */
export const gtaoDenoiseShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.math.PI}
${SHADERS.math.HALF_PI}
${SHADERS.math.saturate}
${SHADERS.gtao.common}
${SHADERS.gtao.denoise}

override GTAO_FINAL_APPLY: bool = false;

@group(0) @binding(${alloc.next()}) var<uniform> uGTAO: GTAOParams;
@group(0) @binding(${alloc.next()}) var uAOTexture: texture_2d<f32>;
@group(0) @binding(${alloc.next()}) var uEdgesTexture: texture_2d<f32>;

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // The reference blurs a fifth as hard on the passes that are not last, so a
  // multi-pass denoise widens its reach without flattening the result.
  let blurAmount = select(uGTAO.denoiseBlurBeta / 5.0, uGTAO.denoiseBlurBeta, GTAO_FINAL_APPLY);

  return gtaoDenoise(vec2i(${FRAGMENT_COORD}), uAOTexture, uEdgesTexture, blurAmount, GTAO_FINAL_APPLY);
}
`);
};

/**
 * Scalable Ambient Obscurance. Writes visibility in `.x`.
 *
 * Reads the depth pyramid rather than the depth buffer: a tap far from its
 * pixel picks a coarser level, which is what keeps the cost flat as the radius
 * grows instead of rising with it.
 */
export const saoShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

// Includes lead: the sao chunk declares SAOParams, the type bound below.
${SHADERS.math.TWO_PI}
${SHADERS.math.saturate}
${SHADERS.colorCorrection}
${SHADERS.depthRead}
${SHADERS.depthPyramid}
${SHADERS.sao}

@group(0) @binding(${alloc.next()}) var<uniform> uSAO: SAOParams;
@group(0) @binding(${alloc.next()}) var uDepthTexture: texture_2d<u32>;
@group(0) @binding(${alloc.next()}) var uNormalTexture: texture_2d<f32>;

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let visibility = sao(
    uDepthTexture,
    uNormalTexture,
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
  // Unit axis, and the reach either side of it in pixels.
  axis: vec2f,
  radius: f32,
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
    uBlur.axis,
    uBlur.radius,
    uPostProcessing.viewportSize,
    uBlur.near,
    uBlur.far,
    uBlur.sharpness
  );
}
`);
};
