import { chunks as SHADERS } from "pex-shaders";

// This shader bakes the analytic Preetham sky model (chunks.sky) into an
// equirectangular env map: a fullscreen quad, no Frame/Model bind groups.
// Attribute @location convention specific to this file: 0 position (vec2,
// clip-space quad corners).
//
// Historically sky-env-map always resolved TONE_MAP to aces and nothing
// ever overrode it, so it's called directly here; the other operators
// ported to chunks.toneMap are for the (not yet ported) post-processing
// tone-map selection.

/**
 * @param {Set<string>} [defines=new Set()]
 * @param {object} [options={}]
 * @param {object} [options.hooks={}] Raw WGSL text injected at fixed points.
 * @param {number} [options.locationNormal=-1] MRT output location for the normal buffer, requires USE_DRAW_BUFFERS.
 * @param {number} [options.locationEmissive=-1] MRT output location for the emissive buffer, requires USE_DRAW_BUFFERS.
 * @param {number} [options.locationVelocity=-1] MRT output location for the velocity buffer, requires USE_DRAW_BUFFERS.
 * @returns {string}
 * @alias module:pipeline.sky
 */
export default (defines = new Set(), options = {}) => {
  const hooks = options.hooks || {};
  const {
    locationNormal = -1,
    locationEmissive = -1,
    locationVelocity = -1,
  } = options;

  const useDrawBuffers = defines.has("USE_DRAW_BUFFERS");
  const useNormalOutput = useDrawBuffers && locationNormal >= 0;
  const useEmissiveOutput = useDrawBuffers && locationEmissive >= 0;
  const useVelocityOutput = useDrawBuffers && locationVelocity >= 0;

  return /* wgsl */ `
struct Sky {
  sunPosition: vec3f,
  parameters: vec4f, // turbidity, rayleigh, mieCoefficient, mieDirectionalG
}
@group(0) @binding(0) var<uniform> uSky: Sky;

struct VertexInput {
  @location(0) position: vec2f,
}

struct Varyings {
  @builtin(position) position: vec4f,
  @location(0) texCoord0: vec2f,
  @location(1) sunDirection: vec3f,
  @location(2) sunfade: f32,
  @location(3) sunE: f32,
  @location(4) betaR: vec3f,
  @location(5) betaM: vec3f,
  @location(6) mieDirectionalG: f32,
}

struct FragmentOutput {
  @location(0) color: vec4f,
  ${useNormalOutput ? `@location(${locationNormal}) normal: vec4f,` : ""}
  ${useEmissiveOutput ? `@location(${locationEmissive}) emissive: vec4f,` : ""}
  ${useVelocityOutput ? `@location(${locationVelocity}) velocity: vec4f,` : ""}
}

// Vertex includes
${SHADERS.math.PI}
${SHADERS.math.saturate}
${SHADERS.sky}

${hooks.vertDeclarationsEnd ?? ""}

@vertex
fn vertexMain(input: VertexInput) -> Varyings {
  var output: Varyings;

  let sky = skyVertex(uSky.sunPosition, uSky.parameters);
  output.sunDirection = sky.sunDirection;
  output.sunfade = sky.sunfade;
  output.sunE = sky.sunE;
  output.betaR = sky.betaR;
  output.betaM = sky.betaM;
  output.mieDirectionalG = sky.mieDirectionalG;

  output.texCoord0 = input.position * 0.5 + 0.5;
  output.position = vec4f(input.position, 0.0, 1.0);

  ${hooks.vertEnd ?? ""}

  return output;
}

// Fragment includes
${SHADERS.math.TWO_PI}
${SHADERS.encodeDecode}

fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3f(0.0), vec3f(1.0));
}

${hooks.fragDeclarationsEnd ?? ""}

@fragment
fn fragmentMain(input: Varyings) -> FragmentOutput {
  var output: FragmentOutput;

  // Texture coordinates to direction:
  // https://web.archive.org/web/20170606085139/http://gl.ict.usc.edu/Data/HighResProbes/
  let theta = PI * (input.texCoord0.x * 2.0 - 1.0);
  let phi = PI * (1.0 - input.texCoord0.y);
  let direction = vec3f(sin(phi) * sin(theta), cos(phi), -sin(phi) * cos(theta));

  let sky = SkyData(
    input.sunDirection,
    input.sunfade,
    input.sunE,
    input.betaR,
    input.betaM,
    input.mieDirectionalG,
  );

  var color = skyFrag(direction, sky);
  color = aces(color);
  color = toLinearVec3(color);

  output.color = vec4f(color, 1.0);

  ${useNormalOutput ? "output.normal = vec4f(0.0, 0.0, 1.0, 1.0);" : ""}
  ${useEmissiveOutput ? "output.emissive = vec4f(0.0);" : ""}
  ${useVelocityOutput ? "output.velocity = vec4f(0.5, 0.5, 0.5, 1.0);" : ""}

  ${hooks.fragEnd ?? ""}

  return output;
}
`;
};
