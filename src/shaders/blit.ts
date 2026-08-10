import { chunks as SHADERS } from "pex-shaders";

import { vertexOutputStruct } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

export const blitShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};

  return /* wgsl */ `
@group(0) @binding(0) var uTexture: texture_2d<f32>;
@group(0) @binding(1) var uTextureSampler: sampler;

struct VertexInput {
  @location(0) position: vec2f,
}

${vertexOutputStruct([{ name: "texCoord0", type: "vec2f" }])}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = input.position * 0.5 + 0.5;
  return output;
}

${SHADERS.encodeDecode}

${hooks.fragDeclarationsEnd ?? ""}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  var color = textureSample(uTexture, uTextureSampler, input.texCoord0);
  color = encode(color, SRGB);

  output.color = color;

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
