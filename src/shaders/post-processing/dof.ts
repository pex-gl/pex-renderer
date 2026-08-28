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

// Bokeh depth of field, single pass. Distances are in millimetres throughout —
// the circle of confusion model is a physical one, and the scene's metres would
// lose precision against a 0.029mm CoC.

/** Depth of field. `USE_DOF_GUSTAFSSON` or `USE_DOF_UPITIS` selects the bokeh model. */
export const dofShader = (defines: Set<string> = new Set()): string => {
  const upitis = defines.has("USE_DOF_UPITIS");
  const focusOnScreenPoint = defines.has("USE_FOCUS_ON_SCREEN_POINT");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

// Includes lead: the depthOfField chunk declares DepthOfFieldParams, the type
// bound below.
${SHADERS.math.saturate}
${SHADERS.math.TWO_PI}
${SHADERS.math.random}
${SHADERS.luma}
${SHADERS.threshold}
${SHADERS.depthRead}
${SHADERS.depthOfField}

@group(0) @binding(${alloc.next()}) var<uniform> uDoFParams: DepthOfFieldParams;

struct DoF {
  focusDistance: f32,
  focusScale: f32,
  screenPoint: vec2f,
}
@group(0) @binding(${alloc.next()}) var<uniform> uDoF: DoF;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")}

${fullscreenVertex()}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Every depth read is offset out of the raster's sub-pixel jitter and back
  // onto the resolved image's grid — see DepthOfFieldParams.depthOffset.
  let depthCoord = input.texCoord0 + uDoFParams.depthOffset;

  // m -> mm
  let focusDistance = ${
    focusOnScreenPoint
      ? "readDepth(uDepthTexture, uDepthTextureSampler, uDoF.screenPoint + uDoFParams.depthOffset, uDoFParams.near, uDoFParams.far)"
      : "uDoF.focusDistance"
  } * 1000.0;
  let centerDepth = readDepth(uDepthTexture, uDepthTextureSampler, depthCoord, uDoFParams.near, uDoFParams.far) * 1000.0;

  // Physical mode makes focusScale an f-stop divider; otherwise it is a
  // heuristic keeping the blur relative to a 1024px-high viewport.
  let focusScale = select(
    (uDoF.focusScale * uPostProcessing.viewportSize.y) / 1024.0 * 1000.0,
    1.0 / uDoF.focusScale,
    USE_DOF_PHYSICAL
  );

  let centerSize = getCoC(centerDepth, focusDistance, focusScale, uDoFParams);

  let color = ${
    upitis
      ? `depthOfFieldUpitis(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    focusDistance,
    centerSize,
    focusScale,
    uDoFParams
  )`
      : `depthOfFieldGustafsson(
    uTexture,
    uTextureSampler,
    uDepthTexture,
    uDepthTextureSampler,
    input.texCoord0,
    focusDistance,
    centerSize,
    focusScale,
    centerDepth,
    uDoFParams
  )`
  };

  // The chain carries alpha through — a canvas configured for a transparent
  // background needs it — and nothing here has an opinion about coverage.
  let alpha = textureSampleLevel(uTexture, uTextureSampler, input.texCoord0, 0.0).a;

  return vec4f(color, alpha);
}
`);
};
