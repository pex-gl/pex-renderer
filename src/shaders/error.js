// See basic.js for the shared Frame/Model bind group conventions.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @param {number} [options.locationNormal=-1] MRT output location for the normal buffer, requires USE_DRAW_BUFFERS.
 * @param {number} [options.locationEmissive=-1] MRT output location for the emissive buffer, requires USE_DRAW_BUFFERS.
 * @returns {string}
 * @alias module:pipeline.error
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

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

struct Model {
  modelMatrix: mat4x4f,
  normalMatrix: mat3x3f,
}
@group(3) @binding(0) var<uniform> uModel: Model;

struct VertexInput {
  @location(0) position: vec3f,
}

struct Varyings {
  @builtin(position) position: vec4f,
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
  output.position = uFrame.projectionMatrix * uFrame.viewMatrix * uModel.modelMatrix * vec4f(input.position, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;
  output.color = vec4f(1.0, 0.0, 0.0, 1.0);

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
