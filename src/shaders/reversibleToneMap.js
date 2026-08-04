import { chunks as SHADERS } from "pex-shaders";

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @returns {string}
 * @alias module:pipeline.reversibleToneMap
 */
export default (defines = new Set(), options = {}) => {
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
