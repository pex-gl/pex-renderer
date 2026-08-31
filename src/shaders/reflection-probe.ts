import { chunks as SHADERS } from "pex-shaders";

// Number of prefiltered roughness levels (mip levels) in the specular cubemap.
// The fragment shader maps perceptual roughness to lod in [0, ROUGHNESS_LEVELS - 1].
export const ROUGHNESS_LEVELS = 6;

// L2 spherical harmonics: 9 coefficients encode the diffuse irradiance.
export const SH_COEFFICIENT_COUNT = 9;

// Directions projected into SH. Uniform sphere sampling (Fibonacci lattice) with
// a constant solid angle per sample, so no equirect distortion weighting is needed.
const SH_SAMPLE_COUNT = 8192;
const SH_WORKGROUP_SIZE = 64;

// GGX importance samples per prefiltered texel. Filtered importance sampling (see
// the prefilter shader) keeps this low without fireflies; bake runs only on dirty.
const PREFILTER_SAMPLE_COUNT = 256;

// Samples the equirectangular environment for a world direction. Expects uEnvMap
// and uEnvMapSampler to be declared by the composing shader.
const sampleEnv = /* wgsl */ `
fn sampleEnv(dir: vec3f) -> vec3f {
  return textureSampleLevel(uEnvMap, uEnvMapSampler, envMapEquirect(dir), 0.0).rgb;
}
`;

// Inverse of the sampler's cube face lookup: for stored texel (face, st) return
// the direction textureSample(cube, dir) resolves to that texel (standard
// WebGPU/D3D/GL cube convention, texel v pointing down).
const cubeDirection = /* wgsl */ `
fn cubeDirection(face: u32, st: vec2f) -> vec3f {
  let u = st.x;
  let v = st.y;
  switch face {
    case 0u: { return vec3f( 1.0,  -v,  -u); }
    case 1u: { return vec3f(-1.0,  -v,   u); }
    case 2u: { return vec3f(  u,  1.0,   v); }
    case 3u: { return vec3f(  u, -1.0,  -v); }
    case 4u: { return vec3f(  u,  -v, 1.0); }
    default: { return vec3f( -u,  -v, -1.0); }
  }
}
`;

// Hammersley low-discrepancy points + GGX importance sampling / distribution,
// Real Shading in Unreal Engine 4 (Karis 2013). roughness is perceptual.
const ggxSampling = /* wgsl */ `
fn radicalInverseVdC(bitsIn: u32) -> f32 {
  var bits = bitsIn;
  bits = (bits << 16u) | (bits >> 16u);
  bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
  bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
  bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
  bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
  return f32(bits) * 2.3283064365386963e-10;
}

fn hammersley(i: u32, n: u32) -> vec2f {
  return vec2f(f32(i) / f32(n), radicalInverseVdC(i));
}

fn importanceSampleGGX(Xi: vec2f, roughness: f32, N: vec3f) -> vec3f {
  let a = roughness * roughness;
  let phi = TWO_PI * Xi.x;
  let cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a * a - 1.0) * Xi.y));
  let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  let H = vec3f(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
  let up = select(vec3f(0.0, 0.0, 1.0), vec3f(1.0, 0.0, 0.0), abs(N.z) >= 0.999);
  let tangent = normalize(cross(up, N));
  let bitangent = cross(N, tangent);
  return normalize(tangent * H.x + bitangent * H.y + N * H.z);
}

fn distributionGGX(NoH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let d = NoH * NoH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
`;

// Real L2 SH basis (z-up ordering) evaluated at a direction, shared by the
// projection (below) and the fragment reconstruction (chunks/indirect.js) so the
// two always agree on basis and index order.
const shBasis = /* wgsl */ `
fn shBasis(n: vec3f) -> array<f32, 9> {
  return array<f32, 9>(
    0.282095,
    0.488603 * n.y,
    0.488603 * n.z,
    0.488603 * n.x,
    1.092548 * n.x * n.y,
    1.092548 * n.y * n.z,
    0.315392 * (3.0 * n.z * n.z - 1.0),
    1.092548 * n.x * n.z,
    0.546274 * (n.x * n.x - n.y * n.y)
  );
}
`;

/**
 * Compute shader projecting an equirectangular environment map into 9 L2 SH
 * coefficients (irradiance). Dispatched as a single workgroup; each invocation
 * accumulates a strided subset of the sample set, then invocation 0 reduces and
 * writes. The cosine-lobe convolution (Ramamoorthi) and the 1/π Lambert factor
 * are baked per band into the stored coefficients, so reconstruction is a plain
 * basis dot product returning the diffuse radiance directly.
 */
export const reflectionProbeSHShader = (): string => /* wgsl */ `
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}

struct Params { exposure: f32 }

@group(0) @binding(0) var uEnvMap: texture_2d<f32>;
@group(0) @binding(1) var uEnvMapSampler: sampler;
@group(0) @binding(2) var<storage, read_write> uIrradianceCoefficients: array<vec4f, ${SH_COEFFICIENT_COUNT}>;
@group(0) @binding(3) var<uniform> uParams: Params;

${SHADERS.envMapEquirect}
${sampleEnv}
${shBasis}

fn fibonacciSphere(i: u32, n: u32) -> vec3f {
  let fi = f32(i);
  let y = 1.0 - (2.0 * fi + 1.0) / f32(n);
  let r = sqrt(max(0.0, 1.0 - y * y));
  let phi = TWO_PI * fi * 0.61803398875;
  return vec3f(r * cos(phi), y, r * sin(phi));
}

var<workgroup> partial: array<array<vec3f, ${SH_COEFFICIENT_COUNT}>, ${SH_WORKGROUP_SIZE}>;

@compute @workgroup_size(${SH_WORKGROUP_SIZE})
fn computeMain(@builtin(local_invocation_index) lid: u32) {
  var acc: array<vec3f, ${SH_COEFFICIENT_COUNT}>;
  for (var k = 0u; k < ${SH_COEFFICIENT_COUNT}u; k++) { acc[k] = vec3f(0.0); }

  var i = lid;
  loop {
    if (i >= ${SH_SAMPLE_COUNT}u) { break; }
    let dir = fibonacciSphere(i, ${SH_SAMPLE_COUNT}u);
    let radiance = sampleEnv(dir);
    let b = shBasis(dir);
    for (var k = 0u; k < ${SH_COEFFICIENT_COUNT}u; k++) { acc[k] += radiance * b[k]; }
    i += ${SH_WORKGROUP_SIZE}u;
  }

  for (var k = 0u; k < ${SH_COEFFICIENT_COUNT}u; k++) { partial[lid][k] = acc[k]; }
  workgroupBarrier();

  if (lid == 0u) {
    let dw = 4.0 * PI / f32(${SH_SAMPLE_COUNT}u);
    // Cosine-lobe convolution per band (Â_l / π): band0 = 1, band1 = 2/3, band2 = 1/4.
    let A = array<f32, 9>(1.0, 2.0 / 3.0, 2.0 / 3.0, 2.0 / 3.0, 0.25, 0.25, 0.25, 0.25, 0.25);
    for (var k = 0u; k < ${SH_COEFFICIENT_COUNT}u; k++) {
      var s = vec3f(0.0);
      for (var t = 0u; t < ${SH_WORKGROUP_SIZE}u; t++) { s += partial[t][k]; }
      uIrradianceCoefficients[k] = vec4f(s * dw * A[k] * uParams.exposure, 0.0);
    }
  }
}
`;

/**
 * Compute shader converting the equirectangular environment into mip 0 of the
 * radiance cubemap. Its mip chain (built by the downsample shader) is the
 * pre-blurred source the prefilter samples from.
 */
export const reflectionProbeEquirectToCubeShader = (): string => /* wgsl */ `
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}

struct Params { faceSize: f32, exposure: f32 }

@group(0) @binding(0) var uEnvMap: texture_2d<f32>;
@group(0) @binding(1) var uEnvMapSampler: sampler;
@group(0) @binding(2) var uOutput: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(3) var<uniform> uParams: Params;

${SHADERS.envMapEquirect}
${sampleEnv}
${cubeDirection}

@compute @workgroup_size(8, 8, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3u) {
  let size = u32(uParams.faceSize);
  if (gid.x >= size || gid.y >= size) { return; }

  let st = (vec2f(f32(gid.x), f32(gid.y)) + 0.5) / uParams.faceSize * 2.0 - 1.0;
  let N = normalize(cubeDirection(gid.z, st));
  textureStore(uOutput, vec2i(gid.xy), i32(gid.z), vec4f(sampleEnv(N) * uParams.exposure, 1.0));
}
`;

/**
 * Compute shader box-downsampling one radiance cubemap mip into the next. The
 * source is bound as a single-level cube view, so a linear cube sample resolves
 * a ~2×2 average with seamless cross-face filtering.
 */
export const reflectionProbeDownsampleShader = (): string => /* wgsl */ `
struct Params { faceSize: f32 }

@group(0) @binding(0) var uSource: texture_cube<f32>;
@group(0) @binding(1) var uSourceSampler: sampler;
@group(0) @binding(2) var uOutput: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(3) var<uniform> uParams: Params;

${cubeDirection}

@compute @workgroup_size(8, 8, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3u) {
  let size = u32(uParams.faceSize);
  if (gid.x >= size || gid.y >= size) { return; }

  let st = (vec2f(f32(gid.x), f32(gid.y)) + 0.5) / uParams.faceSize * 2.0 - 1.0;
  let N = normalize(cubeDirection(gid.z, st));
  let color = textureSampleLevel(uSource, uSourceSampler, N, 0.0).rgb;
  textureStore(uOutput, vec2i(gid.xy), i32(gid.z), vec4f(color, 1.0));
}
`;

/**
 * Compute shader prefiltering the radiance cubemap into one roughness level of
 * the specular cubemap via GGX importance sampling (split-sum). Each sample is
 * fetched from the radiance mip whose texel solid angle matches the sample's
 * footprint (filtered importance sampling, Colbert & Krivánek), which removes
 * the coherent under-sampling noise a full-resolution fetch produces.
 * One dispatch per roughness level writes all six faces via a 2d-array view.
 */
export const reflectionProbePrefilterShader = (): string => /* wgsl */ `
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}
${SHADERS.math.saturate}

struct Params {
  faceSize: f32,
  roughness: f32,
  sampleCount: f32,
  cubeResolution: f32,
}

@group(0) @binding(0) var uRadianceCube: texture_cube<f32>;
@group(0) @binding(1) var uRadianceCubeSampler: sampler;
@group(0) @binding(2) var uOutput: texture_storage_2d_array<rgba16float, write>;
@group(0) @binding(3) var<uniform> uParams: Params;

${cubeDirection}
${ggxSampling}

fn prefilter(roughness: f32, R: vec3f) -> vec3f {
  let N = R;
  let V = R;
  var prefiltered = vec3f(0.0);
  var totalWeight = 0.0;
  let numSamples = u32(uParams.sampleCount);
  // Solid angle covered by one radiance-cube texel at the base resolution.
  let saTexel = 4.0 * PI / (6.0 * uParams.cubeResolution * uParams.cubeResolution);

  for (var i = 0u; i < numSamples; i++) {
    let Xi = hammersley(i, numSamples);
    let H = importanceSampleGGX(Xi, roughness, N);
    let L = normalize(2.0 * dot(V, H) * H - V);
    let NoL = saturateF32(dot(N, L));
    if (NoL > 0.0) {
      let NoH = saturateF32(dot(N, H));
      // pdf of the GGX sample (V == N so VoH == NoH, pdf = D / 4).
      let pdf = distributionGGX(NoH, roughness) * 0.25 + 1e-4;
      let saSample = 1.0 / (f32(numSamples) * pdf + 1e-4);
      // Pick the mip whose texel footprint matches this sample's solid angle.
      let mip = max(0.5 * log2(saSample / saTexel), 0.0);
      prefiltered += textureSampleLevel(uRadianceCube, uRadianceCubeSampler, L, mip).rgb * NoL;
      totalWeight += NoL;
    }
  }
  if (totalWeight <= 0.0) {
    return textureSampleLevel(uRadianceCube, uRadianceCubeSampler, R, 0.0).rgb;
  }
  return prefiltered / totalWeight;
}

@compute @workgroup_size(8, 8, 1)
fn computeMain(@builtin(global_invocation_id) gid: vec3u) {
  let size = u32(uParams.faceSize);
  if (gid.x >= size || gid.y >= size) { return; }

  let st = (vec2f(f32(gid.x), f32(gid.y)) + 0.5) / uParams.faceSize * 2.0 - 1.0;
  let N = normalize(cubeDirection(gid.z, st));

  var color: vec3f;
  if (uParams.roughness <= 0.0) {
    color = textureSampleLevel(uRadianceCube, uRadianceCubeSampler, N, 0.0).rgb;
  } else {
    color = prefilter(uParams.roughness, N);
  }

  textureStore(uOutput, vec2i(gid.xy), i32(gid.z), vec4f(color, 1.0));
}
`;

export const PREFILTER_SAMPLE_COUNT_DEFAULT = PREFILTER_SAMPLE_COUNT;
