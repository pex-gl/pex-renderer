import { fragmentOutputStruct, vertexOutputStruct } from "./wgsl.js";
import type { PipelineShaderOptions } from "../types.js";

/**
 * Copies the main pass's color target into the (same-or-smaller,
 * power-of-two) grab pass texture, top-left anchored. Both textures share the
 * same origin, so the fragment position doubles directly as the source texel
 * coordinate — an exact copy needs no sampler or UV remap.
 */
export const grabPassShader = (
  defines: Set<string> = new Set(),
  options: PipelineShaderOptions = {},
): string => {
  const hooks = options.hooks || {};

  return /* wgsl */ `
@group(0) @binding(0) var uTexture: texture_2d<f32>;

struct VertexInput {
  @location(0) position: vec2f,
}

${vertexOutputStruct([])}

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  return output;
}

${hooks.fragDeclarationsEnd ?? ""}

${fragmentOutputStruct()}

@fragment
fn fragmentMain(input: VertexOutput) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = textureLoad(uTexture, vec2i(input.position.xy), 0);

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
