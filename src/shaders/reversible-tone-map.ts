import { chunks as SHADERS } from "pex-shaders";

import type { PipelineShaderOptions } from "../types.js";

export const reversibleToneMapShader = (
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

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) texCoord0: vec2f,
}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.texCoord0 = input.position * 0.5 + 0.5;
  return output;
}

// Fragment includes
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

struct FragmentOutput {
  @location(0) color: vec4f,
}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;
  var color = textureSample(uTexture, uTextureSampler, input.texCoord0);
  color = vec4f(reversibleToneMapInverse(color.rgb), color.w);

  output.color = color;

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
