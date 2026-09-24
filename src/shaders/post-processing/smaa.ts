import { smaa as SMAA } from "pex-shaders";
import {
  bindingDeclaration,
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
} from "../wgsl.js";
import { fullscreenVertex, postProcessingStruct } from "./common.js";

// SMAA 1x and T2x, from wgsl-smaa's chunks. Every pass shares the common
// fullscreen vertex stage: the algorithm's search offsets are affine in the
// texture coordinate, so they are derived per fragment from the texel size
// rather than interpolated.
//
// Texture coordinates keep the top-left origin the reference implementation
// assumes, which is also WebGPU's.

/**
 * The renderer's motion vectors point from this frame to the last (see
 * FRAGMENT_VELOCITY), SMAA's the other way round, as a motion blur velocity
 * buffer would.
 */
const decodeVelocity = /* wgsl */ `
fn smaaDecodeVelocity(sample: vec4f) -> vec2f {
  return -sample.rg;
}
`;

/**
 * Pass 1: writes the left/top edge pair, discarding where there is none.
 *
 * Luma or color edges by default, `SMAA_EDGES_DEPTH` for depth ones, and
 * `USE_SMAA_PREDICATION` to lower the luma/color threshold where depth has an
 * edge.
 */
export const smaaEdgesShader = (defines: Set<string> = new Set()): string => {
  const depth = defines.has("SMAA_EDGES_DEPTH");
  const color = defines.has("SMAA_EDGES_COLOR");
  const predication = !depth && defines.has("USE_SMAA_PREDICATION");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${depth ? "" : textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${
  depth || predication
    ? textureSamplerDeclaration(
        0,
        alloc.nextTextureSampler(),
        "uDepthTexture",
        "texture_depth_2d",
      )
    : ""
}

${fullscreenVertex()}

// Includes
${SMAA.chunks.edges}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let offsets = smaaEdgeDetectionOffsets(input.texCoord0, uPostProcessing.texelSize);

  let edges = ${
    depth
      ? "smaaDepthEdgeDetection(uDepthTexture, uDepthTextureSampler, input.texCoord0, offsets[0])"
      : `${color ? "smaaColorEdgeDetection" : "smaaLumaEdgeDetection"}(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    offsets[0],
    offsets[1],
    offsets[2],
    ${
      predication
        ? "smaaCalculatePredicatedThreshold(uDepthTexture, uDepthTextureSampler, input.texCoord0, offsets[0])"
        : "vec2f(SMAA_THRESHOLD)"
    }
  )`
  };

  return vec4f(edges, 0.0, 1.0);
}
`);
};

/**
 * Pass 2: turns edges into per-side blending weights. Subsample indices are
 * zero for 1x, and select the area texture's rows matching the jitter for T2x.
 */
export const smaaWeightsShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

struct SMAA {
  subsampleIndices: vec4f,
}
@group(0) @binding(${alloc.next()}) var<uniform> uSMAA: SMAA;

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uEdgesTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uAreaTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uSearchTexture")}

${fullscreenVertex()}

// Includes
${SMAA.chunks.weights}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let viewportSize = uPostProcessing.viewportSize;
  let texelSize = uPostProcessing.texelSize;
  let offsets = smaaBlendingWeightCalculationOffsets(input.texCoord0, texelSize);

  return smaaBlendingWeightCalculation(
    uEdgesTexture,
    uEdgesTextureSampler,
    uAreaTexture,
    uAreaTextureSampler,
    uSearchTexture,
    uSearchTextureSampler,
    viewportSize,
    texelSize,
    input.texCoord0,
    input.texCoord0 * viewportSize,
    offsets[0],
    offsets[1],
    offsets[2],
    uSMAA.subsampleIndices
  );
}
`);
};

/**
 * Pass 3: blends each pixel with the neighbour its weights point at.
 * `USE_SMAA_REPROJECTION` also packs the antialiased velocity into alpha, for
 * the temporal resolve.
 */
export const smaaBlendShader = (defines: Set<string> = new Set()): string => {
  const reprojection = defines.has("USE_SMAA_REPROJECTION");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uBlendTexture")}
${
  reprojection
    ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture")
    : ""
}

${fullscreenVertex()}

// Includes
${decodeVelocity}
${SMAA.chunks.blend}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let texelSize = uPostProcessing.texelSize;

  return ${reprojection ? "smaaNeighborhoodBlendingReprojection" : "smaaNeighborhoodBlending"}(
    uTexture,
    uTextureSampler,
    uBlendTexture,
    uBlendTextureSampler,${
      reprojection
        ? `
    uVelocityTexture,
    uVelocityTextureSampler,`
        : ""
    }
    texelSize,
    input.texCoord0,
    smaaNeighborhoodBlendingOffset(input.texCoord0, texelSize)
  );
}
`);
};

/**
 * T2x resolve: this frame's blend output (`uTexture`) with the previous one's
 * (`uHistoryTexture`), both read through `uTextureSampler`.
 * `USE_SMAA_REPROJECTION` follows the velocity to where each pixel was, and
 * takes alpha from the image SMAA started from (`uColorTexture`): the blend
 * packed velocity where the image's own alpha was, and the chain after this
 * composites with it.
 */
export const smaaResolveShader = (defines: Set<string> = new Set()): string => {
  const reprojection = defines.has("USE_SMAA_REPROJECTION");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${bindingDeclaration(0, alloc.next(), "uHistoryTexture", "texture_2d<f32>")}
${
  reprojection
    ? `${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uVelocityTexture")}
${bindingDeclaration(0, alloc.next(), "uColorTexture", "texture_2d<f32>")}`
    : ""
}

${fullscreenVertex()}

// Includes
${decodeVelocity}
${SMAA.chunks.resolve}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  ${
    reprojection
      ? `let resolved = smaaResolveReprojection(
    uTexture,
    uHistoryTexture,
    uTextureSampler,
    uVelocityTexture,
    uVelocityTextureSampler,
    input.texCoord0
  );
  let alpha = textureSampleLevel(uColorTexture, uTextureSampler, input.texCoord0, 0.0).a;

  return vec4f(resolved.rgb, alpha);`
      : `return smaaResolve(uTexture, uHistoryTexture, uTextureSampler, input.texCoord0);`
  }
}
`);
};
