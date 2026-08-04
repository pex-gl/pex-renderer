// A fixed NDC-space screen quad, like blit.js: no Frame/Model needed, just
// the bounds rect (in 0-1 viewport space) and the source texture at group 0.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @returns {string}
 * @alias module:pipeline.overlay
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};

  return /* wgsl */ `
struct Overlay {
  bounds: vec4f, // x, y, width, height
}
@group(0) @binding(0) var<uniform> uOverlay: Overlay;
@group(0) @binding(1) var uTexture: texture_2d<f32>;
@group(0) @binding(2) var uTextureSampler: sampler;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texCoord0: vec2f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) texCoord0: vec2f,
}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  var pos = (input.position + 1.0) / 2.0; // move from -1..1 to 0..1
  pos = vec2f(
    uOverlay.bounds.x + pos.x * uOverlay.bounds.z,
    uOverlay.bounds.y + pos.y * uOverlay.bounds.w
  );
  pos = pos * 2.0 - 1.0;

  output.position = vec4f(pos, 0.0, 1.0);
  output.texCoord0 = input.texCoord0;

  ${hooks.vertEnd ?? ""}

  return output;
}

struct FragmentOutput {
  @location(0) color: vec4f,
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = textureSample(uTexture, uTextureSampler, input.texCoord0);

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
