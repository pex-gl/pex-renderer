import { chunks as SHADERS } from "pex-shaders";

// Draws an equirectangular environment map (a baked analytic sky or a user
// envMap) as the scene background. A fullscreen triangle (attribute @location(0)
// position: vec2f, clip-space corners) is unprojected into a world-space view
// direction and used to sample the equirect map.
//
// The env map is already linear (a float HDR map, or the sky baked into an
// rgba8unorm-srgb texture that decodes on sample), so no decode is needed; the
// result feeds the linear HDR main pass.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @param {number} [options.locationNormal=-1] MRT output location for the normal buffer, requires USE_DRAW_BUFFERS.
 * @param {number} [options.locationEmissive=-1] MRT output location for the emissive buffer, requires USE_DRAW_BUFFERS.
 * @returns {string}
 * @alias module:pipeline.skybox
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};
  const { locationNormal = -1, locationEmissive = -1 } = options;

  const useMSAA = defines.has("USE_MSAA");
  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;

  return /* wgsl */ `
struct Skybox {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  modelMatrix: mat4x4f,
  exposure: f32,
}
@group(0) @binding(0) var<uniform> uSkybox: Skybox;
@group(0) @binding(1) var uEnvMap: texture_2d<f32>;
@group(0) @binding(2) var uEnvMapSampler: sampler;

struct VertexInput {
  @location(0) position: vec2f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
}

// Vertex includes
${SHADERS.math.inverseMat4}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  let inverseProjection = inverseMat4(uSkybox.projectionMatrix);
  let inverseModelView = transpose(mat3x3f(
    uSkybox.viewMatrix[0].xyz,
    uSkybox.viewMatrix[1].xyz,
    uSkybox.viewMatrix[2].xyz,
  ));
  let unprojected = (inverseProjection * vec4f(input.position, 0.0, 1.0)).xyz;
  output.normal = (uSkybox.modelMatrix * vec4f(inverseModelView * unprojected, 1.0)).xyz;

  // z = 1.0 sits at the ZO far plane so geometry (depthCompare less-equal) wins.
  output.position = vec4f(input.position, 1.0, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}
${SHADERS.math.max3}
${SHADERS.envMapEquirect}
${SHADERS.reversibleToneMap}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;

  let N = normalize(input.normal);
  // envMapEquirect's vertical axis assumes a WebGL bottom-origin texture; the map
  // is rendered/uploaded top-origin under WebGPU, so flip v.
  let uv = envMapEquirect(N);
  var color = textureSample(uEnvMap, uEnvMapSampler, vec2f(uv.x, 1.0 - uv.y));
  color = vec4f(color.rgb * uSkybox.exposure, color.a);

  ${useMSAA ? "color = vec4f(reversibleToneMap(color.xyz), color.w);" : ""}

  output.color = color;

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
