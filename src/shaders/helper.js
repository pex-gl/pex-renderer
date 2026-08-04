import { chunks as SHADERS } from "pex-shaders";

// Debug helper geometry (grids, gizmos, bounding boxes) is authored directly
// in world space, so unlike basic.js/standard.js there is no @group(3) Model
// (no modelMatrix). @location(5) for vertexColor still matches the shared
// mesh attribute convention, leaving 1-4 free for parity with other pipelines.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @param {number} [options.locationNormal=-1] MRT output location for the normal buffer, requires USE_DRAW_BUFFERS.
 * @param {number} [options.locationEmissive=-1] MRT output location for the emissive buffer, requires USE_DRAW_BUFFERS.
 * @returns {string}
 * @alias module:pipeline.helper
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;

  return /* wgsl */ `
struct Frame {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  inverseViewMatrix: mat4x4f,
  cameraPosition: vec3f,
  viewportSize: vec2f,
}
@group(0) @binding(0) var<uniform> uFrame: Frame;

struct VertexInput {
  @location(0) position: vec3f,
  @location(5) vertexColor: vec4f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;
  output.color = input.vertexColor;
  output.position = uFrame.projectionMatrix * uFrame.viewMatrix * vec4f(input.position, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.encodeDecode}
${SHADERS.math.max3}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;
  var color = decode(input.color, SRGB);

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  output.color = color;

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
