import { chunks } from "pex-shaders";

// pex-shaders' generated types lag behind its chunks until it is rebuilt
// (same reason as the casts in shaders/standard.ts and shaders/sky.ts).
const SHADERS = chunks as any;

import {
  createBindingAllocator,
  formatShader,
  textureSamplerDeclaration,
  vertexOutputStruct,
} from "../wgsl.js";
import { postProcessingStruct } from "./common.js";

// SMAA 1x, three passes. Each has its own vertex stage: the taps are not a
// symmetric neighbourhood like the other effects' but the algorithm's specific
// search offsets, so they don't go through common.ts's shared one.
//
// Texture coordinates keep the top-left origin the reference implementation
// assumes (see the smaa chunk), which is also WebGPU's.

const TEX_COORD = "vec2f(input.position.x * 0.5 + 0.5, 0.5 - input.position.y * 0.5)";

const VERTEX_INPUT = /* wgsl */ `
struct VertexInput {
  @location(0) position: vec2f,
}
`;

/** Pass 1: writes the left/top edge pair, discarding where there is none. */
export const smaaEdgesShader = (defines: Set<string> = new Set()): string => {
  const depth = defines.has("SMAA_EDGES_DEPTH");
  const color = defines.has("SMAA_EDGES_COLOR");

  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${
  depth
    ? textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uDepthTexture", "texture_depth_2d")
    : textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")
}

${VERTEX_INPUT}

${vertexOutputStruct([
  { name: "texCoord0", type: "vec2f" },
  { name: "offset0", type: "vec4f" },
  { name: "offset1", type: "vec4f" },
  { name: "offset2", type: "vec4f" },
])}

// Includes
${SHADERS.encodeDecode}
${SHADERS.smaa.common}
${SHADERS.smaa.edges}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = ${TEX_COORD};

  let texelSize = uPostProcessing.texelSize.xyxy;
  output.offset0 = texelSize * vec4f(-1.0, 0.0, 0.0, -1.0) + output.texCoord0.xyxy;
  output.offset1 = texelSize * vec4f(1.0, 0.0, 0.0, 1.0) + output.texCoord0.xyxy;
  output.offset2 = texelSize * vec4f(-2.0, 0.0, 0.0, -2.0) + output.texCoord0.xyxy;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let edges = ${
    depth
      ? "smaaDepthEdgeDetection(uDepthTexture, uDepthTextureSampler, input.texCoord0, input.offset0)"
      : `${color ? "smaaColorEdgeDetection" : "smaaLumaEdgeDetection"}(
    uTexture,
    uTextureSampler,
    input.texCoord0,
    input.offset0,
    input.offset1,
    input.offset2
  )`
  };

  return vec4f(edges, 0.0, 1.0);
}
`);
};

/** Pass 2: turns edges into per-side blending weights. */
export const smaaWeightsShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uEdgesTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uAreaTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uSearchTexture")}

${VERTEX_INPUT}

${vertexOutputStruct([
  { name: "texCoord0", type: "vec2f" },
  { name: "pixCoord", type: "vec2f" },
  { name: "offset0", type: "vec4f" },
  { name: "offset1", type: "vec4f" },
  { name: "offset2", type: "vec4f" },
])}

// Includes
${SHADERS.math.saturate}
${SHADERS.smaa.common}
${SHADERS.smaa.weights}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = ${TEX_COORD};
  output.pixCoord = output.texCoord0 * uPostProcessing.viewportSize;

  // Quarter-texel offsets so one bilinear fetch reads four edges at once
  // (@PSEUDO_GATHER4).
  let texelSize = uPostProcessing.texelSize.xyxy;
  output.offset0 = texelSize * vec4f(-0.25, -0.125, 1.25, -0.125) + output.texCoord0.xyxy;
  output.offset1 = texelSize * vec4f(-0.125, -0.25, -0.125, 1.25) + output.texCoord0.xyxy;

  // And these mark where the searches end
  output.offset2 =
    uPostProcessing.texelSize.xxyy *
    (vec4f(-2.0, 2.0, -2.0, 2.0) * f32(SMAA_MAX_SEARCH_STEPS)) +
    vec4f(output.offset0.xz, output.offset1.yw);

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // SMAA 1x: no subsample indices (see @SUBSAMPLE_INDICES).
  return smaaBlendingWeightCalculation(
    uEdgesTexture,
    uEdgesTextureSampler,
    uAreaTexture,
    uAreaTextureSampler,
    uSearchTexture,
    uSearchTextureSampler,
    uPostProcessing.viewportSize,
    uPostProcessing.texelSize,
    input.texCoord0,
    input.pixCoord,
    input.offset0,
    input.offset1,
    input.offset2,
    vec4f(0.0)
  );
}
`);
};

/** Pass 3: blends each pixel with the neighbour its weights point at. */
export const smaaBlendShader = (): string => {
  const alloc = createBindingAllocator(1);

  return formatShader(/* wgsl */ `
${postProcessingStruct}

${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uTexture")}
${textureSamplerDeclaration(0, alloc.nextTextureSampler(), "uBlendTexture")}

${VERTEX_INPUT}

${vertexOutputStruct([
  { name: "texCoord0", type: "vec2f" },
  { name: "offset", type: "vec4f" },
])}

// Includes
${SHADERS.smaa.common}
${SHADERS.smaa.blend}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = ${TEX_COORD};
  output.offset = uPostProcessing.texelSize.xyxy * vec4f(1.0, 0.0, 0.0, 1.0) + output.texCoord0.xyxy;

  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return smaaNeighborhoodBlending(
    uTexture,
    uTextureSampler,
    uBlendTexture,
    uBlendTextureSampler,
    uPostProcessing.texelSize,
    input.texCoord0,
    input.offset
  );
}
`);
};
