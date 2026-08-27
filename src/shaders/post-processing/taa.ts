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
export const taaShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.luminance}
${SHADERS.taa}

@group(0) @binding(${alloc.next()}) var<uniform> uTAA: TAAParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uHistoryTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return taaResolve(
    input.texCoord0,
    uTexture,
    uTextureSampler,
    uHistoryTexture,
    uHistoryTextureSampler,
    uDepthTexture,
    uDepthTextureSampler,
    uTAA
  );
}
`);
};
