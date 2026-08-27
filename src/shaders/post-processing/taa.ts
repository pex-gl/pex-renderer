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
export const taaShader = (defines: Set<string> = new Set()): string => {
  const alloc = createBindingAllocator(1);
  const velocity = defines.has("USE_TAA_VELOCITY");

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${SHADERS.luminance}
${SHADERS.taa}

@group(0) @binding(${alloc.next()}) var<uniform> uTAA: TAAParams;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uHistoryTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}
${velocity ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture") : ""}

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

  return taaResolve(
    uv,
    previousUV,
    reprojectionValid,
    uTexture,
    uTextureSampler,
    uHistoryTexture,
    uHistoryTextureSampler,
    uTAA
  );
}
`);
};
