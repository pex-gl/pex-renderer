var aces_glsl = /* glsl */ `// Narkowicz 2015, "ACES Filmic Tone Mapping Curve"
vec3 aces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float aces(float x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

`;

var agx_glsl = /* glsl */ `
// Missing Deadlines (Benjamin Wrensch): https://iolite-engine.com/blog_posts/minimal_agx_implementation
// Filament: https://github.com/google/filament/blob/main/filament/src/ToneMapper.cpp#L263
// https://github.com/EaryChow/AgX_LUT_Gen/blob/main/AgXBaseRec2020.py

// Three.js: https://github.com/mrdoob/three.js/blob/4993e3af579a27cec950401b523b6e796eab93ec/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js#L79-L89
// Matrices for rec 2020 <> rec 709 color space conversion
// matrix provided in row-major order so it has been transposed
// https://www.itu.int/pub/R-REP-BT.2407-2017
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
  1.6605, -0.1246, -0.0182,
  -0.5876, 1.1329, -0.1006,
  -0.0728, -0.0083, 1.1187
);

const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
  0.6274, 0.0691, 0.0164,
  0.3293, 0.9195, 0.0880,
  0.0433, 0.0113, 0.8956
);

// Converted to column major from blender: https://github.com/blender/blender/blob/fc08f7491e7eba994d86b610e5ec757f9c62ac81/release/datafiles/colormanagement/config.ocio#L358
const mat3 AgXInsetMatrix = mat3(
  0.856627153315983, 0.137318972929847, 0.11189821299995,
  0.0951212405381588, 0.761241990602591, 0.0767994186031903,
  0.0482516061458583, 0.101439036467562, 0.811302368396859
);

// Converted to column major and inverted from https://github.com/EaryChow/AgX_LUT_Gen/blob/ab7415eca3cbeb14fd55deb1de6d7b2d699a1bb9/AgXBaseRec2020.py#L25
// https://github.com/google/filament/blob/bac8e58ee7009db4d348875d274daf4dd78a3bd1/filament/src/ToneMapper.cpp#L273-L278
const mat3 AgXOutsetMatrix = mat3(
  1.1271005818144368, -0.1413297634984383, -0.14132976349843826,
  -0.11060664309660323, 1.157823702216272, -0.11060664309660294,
  -0.016493938717834573, -0.016493938717834257, 1.2519364065950405
);

const float AgxMinEv = -12.47393;
const float AgxMaxEv = 4.026069;

// Sample usage
vec3 agxCdl(vec3 color, vec3 slope, vec3 offset, vec3 power, float saturation) {
  color = LINEAR_SRGB_TO_LINEAR_REC2020 * color; // From three.js

  // 1. agx()
  // Input transform (inset)
  color = AgXInsetMatrix * color;

  color = max(color, 1e-10); // From Filament: avoid 0 or negative numbers for log2

  // Log2 space encoding
  color = clamp(log2(color), AgxMinEv, AgxMaxEv);
  color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv);

  color = clamp(color, 0.0, 1.0); // From Filament

  // Apply sigmoid function approximation
  // Mean error^2: 3.6705141e-06
  vec3 x2 = color * color;
  vec3 x4 = x2 * x2;
  color = + 15.5     * x4 * x2
          - 40.14    * x4 * color
          + 31.96    * x4
          - 6.868    * x2 * color
          + 0.4298   * x2
          + 0.1191   * color
          - 0.00232;

  // 2. agxLook()
  color = pow(color * slope + offset, power);
  const vec3 lw = vec3(0.2126, 0.7152, 0.0722);
  float luma = dot(color, lw);
  color = luma + saturation * (color - luma);

  // 3. agxEotf()
  // Inverse input transform (outset)
  color = AgXOutsetMatrix * color;

  // sRGB IEC 61966-2-1 2.2 Exponent Reference EOTF Display
  // NOTE: We're linearizing the output here. Comment/adjust when
  // *not* using a sRGB render target
  color = pow(max(vec3(0.0), color), vec3(2.2)); // From filament: max()

  color = LINEAR_REC2020_TO_LINEAR_SRGB * color; // From three.js
  // Gamut mapping. Simple clamp for now.
	color = clamp(color, 0.0, 1.0);

  return color;
}

vec3 agx(vec3 color) {
  return agxCdl(color, vec3(1.0), vec3(0.0), vec3(1.0), 1.0);
}

vec3 agxGolden(vec3 color) {
  return agxCdl(color, vec3(1.0, 0.9, 0.5), vec3(0.0), vec3(0.8), 1.3);
}

vec3 agxPunchy(vec3 color) {
  return agxCdl(color, vec3(1.0), vec3(0.0), vec3(1.35), 1.4);
}
`;

var filmic_glsl = /* glsl */ `// Filmic Tonemapping Operators http://filmicworlds.com/blog/filmic-tonemapping-operators/
vec3 filmic(vec3 x) {
  vec3 X = max(vec3(0.0), x - 0.004);
  vec3 result = (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
  return pow(result, vec3(2.2));
}

float filmic(float x) {
  float X = max(0.0, x - 0.004);
  float result = (X * (6.2 * X + 0.5)) / (X * (6.2 * X + 1.7) + 0.06);
  return pow(result, 2.2);
}

`;

var lottes_glsl = /* glsl */ `// Lottes 2016, "Advanced Techniques and Optimization of HDR Color Pipelines"
vec3 lottes(vec3 x) {
  const vec3 a = vec3(1.6);
  const vec3 d = vec3(0.977);
  const vec3 hdrMax = vec3(8.0);
  const vec3 midIn = vec3(0.18);
  const vec3 midOut = vec3(0.267);

  const vec3 b =
      (-pow(midIn, a) + pow(hdrMax, a) * midOut) /
      ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);
  const vec3 c =
      (pow(hdrMax, a * d) * pow(midIn, a) - pow(hdrMax, a) * pow(midIn, a * d) * midOut) /
      ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);

  return pow(x, a) / (pow(x, a * d) * b + c);
}

float lottes(float x) {
  const float a = 1.6;
  const float d = 0.977;
  const float hdrMax = 8.0;
  const float midIn = 0.18;
  const float midOut = 0.267;

  const float b =
      (-pow(midIn, a) + pow(hdrMax, a) * midOut) /
      ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);
  const float c =
      (pow(hdrMax, a * d) * pow(midIn, a) - pow(hdrMax, a) * pow(midIn, a * d) * midOut) /
      ((pow(hdrMax, a * d) - pow(midIn, a * d)) * midOut);

  return pow(x, a) / (pow(x, a * d) * b + c);
}

`;

var neutral_glsl = /* glsl */ `// Khronos PBR Neutral Tone Mapper
// https://github.com/KhronosGroup/ToneMapping/tree/main/PBR_Neutral

// Input color is non-negative and resides in the Linear Rec. 709 color space.
// Output color is also Linear Rec. 709, but in the [0, 1] range.
vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;

  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;

  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;

  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;

  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

`;

var reinhard_glsl = /* glsl */ `vec3 reinhard(vec3 x) {
  return x / (1.0 + x);
}

float reinhard(float x) {
  return x / (1.0 + x);
}

`;

var reinhard2_glsl = /* glsl */ `vec3 reinhard2(vec3 x) {
  const float L_white = 4.0;

  return (x * (1.0 + x / (L_white * L_white))) / (1.0 + x);
}

float reinhard2(float x) {
  const float L_white = 4.0;

  return (x * (1.0 + x / (L_white * L_white))) / (1.0 + x);
}

`;

var uchimura_glsl = /* glsl */ `// Uchimura 2017, "HDR theory and practice"
// Math: https://www.desmos.com/calculator/gslcdxvipg
// Source: https://www.slideshare.net/nikuque/hdr-theory-and-practicce-jp
vec3 uchimura(vec3 x, float P, float a, float m, float l, float c, float b) {
  float l0 = ((P - m) * l) / a;
  float L0 = m - m / a;
  float L1 = m + (1.0 - m) / a;
  float S0 = m + l0;
  float S1 = m + a * l0;
  float C2 = (a * P) / (P - S1);
  float CP = -C2 / P;

  vec3 w0 = vec3(1.0 - smoothstep(0.0, m, x));
  vec3 w2 = vec3(step(m + l0, x));
  vec3 w1 = vec3(1.0 - w0 - w2);

  vec3 T = vec3(m * pow(x / m, vec3(c)) + b);
  vec3 S = vec3(P - (P - S1) * exp(CP * (x - S0)));
  vec3 L = vec3(m + a * (x - m));

  return T * w0 + L * w1 + S * w2;
}

vec3 uchimura(vec3 x) {
  const float P = 1.0;  // max display brightness
  const float a = 1.0;  // contrast
  const float m = 0.22; // linear section start
  const float l = 0.4;  // linear section length
  const float c = 1.33; // black
  const float b = 0.0;  // pedestal

  return uchimura(x, P, a, m, l, c, b);
}

float uchimura(float x, float P, float a, float m, float l, float c, float b) {
  float l0 = ((P - m) * l) / a;
  float L0 = m - m / a;
  float L1 = m + (1.0 - m) / a;
  float S0 = m + l0;
  float S1 = m + a * l0;
  float C2 = (a * P) / (P - S1);
  float CP = -C2 / P;

  float w0 = 1.0 - smoothstep(0.0, m, x);
  float w2 = step(m + l0, x);
  float w1 = 1.0 - w0 - w2;

  float T = m * pow(x / m, c) + b;
  float S = P - (P - S1) * exp(CP * (x - S0));
  float L = m + a * (x - m);

  return T * w0 + L * w1 + S * w2;
}

float uchimura(float x) {
  const float P = 1.0;  // max display brightness
  const float a = 1.0;  // contrast
  const float m = 0.22; // linear section start
  const float l = 0.4;  // linear section length
  const float c = 1.33; // black
  const float b = 0.0;  // pedestal

  return uchimura(x, P, a, m, l, c, b);
}

`;

var uncharted2_glsl = /* glsl */ `vec3 uncharted2Tonemap(vec3 x) {
  float A = 0.15;
  float B = 0.50;
  float C = 0.10;
  float D = 0.20;
  float E = 0.02;
  float F = 0.30;
  float W = 11.2;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

vec3 uncharted2(vec3 color) {
  const float W = 11.2;
  float exposureBias = 2.0;
  vec3 curr = uncharted2Tonemap(exposureBias * color);
  vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W));
  return curr * whiteScale;
}

float uncharted2Tonemap(float x) {
  float A = 0.15;
  float B = 0.50;
  float C = 0.10;
  float D = 0.20;
  float E = 0.02;
  float F = 0.30;
  float W = 11.2;
  return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
}

float uncharted2(float color) {
  const float W = 11.2;
  const float exposureBias = 2.0;
  float curr = uncharted2Tonemap(exposureBias * color);
  float whiteScale = 1.0 / uncharted2Tonemap(W);
  return curr * whiteScale;
}

`;

var unreal_glsl = /* glsl */ `// Unreal 3, Documentation: "Color Grading"
// Adapted to be close to Tonemap_ACES, with similar range
// Gamma 2.2 correction is baked in, don't use with sRGB conversion!
vec3 unreal(vec3 x) {
  return x / (x + 0.155) * 1.019;
}

float unreal(float x) {
  return x / (x + 0.155) * 1.019;
}

`;

var glslToneMap = /*#__PURE__*/Object.freeze({
  __proto__: null,
  ACES: aces_glsl,
  AGX: agx_glsl,
  FILMIC: filmic_glsl,
  LOTTES: lottes_glsl,
  NEUTRAL: neutral_glsl,
  REINHARD: reinhard_glsl,
  REINHARD2: reinhard2_glsl,
  UCHIMURA: uchimura_glsl,
  UNCHARTED2: uncharted2_glsl,
  UNREAL: unreal_glsl
});

const texture = /* glsl */ `
  #define texture2D texture
  #define textureCube texture
  #define texture2DProj textureProj
`;
const vert = /* glsl */ `
#if (__VERSION__ >= 300)
  #define attribute in
  #define varying out
  ${texture}
#endif
`;
const frag = /* glsl */ `
#ifndef LOCATION_NORMAL
  #define LOCATION_NORMAL -1
#endif
#ifndef LOCATION_EMISSIVE
  #define LOCATION_EMISSIVE -1
#endif

#if (__VERSION__ >= 300)
  #define varying in
  ${texture}

  // EXT_frag_depth
  #define gl_FragDepthEXT gl_FragDepth

  // EXT_shader_texture_lod
  #define texture2DLodEXT textureLod
  #define texture2DProjLodEXT textureProjLod
  #define textureCubeLodEXT textureLod
  #define texture2DGradEXT textureGrad
  #define texture2DProjGradEXT textureProjGrad
  #define textureCubeGradEXT textureGrad

  vec4 FragData[3];
  #define gl_FragData FragData
  #define gl_FragColor gl_FragData[0]

  layout (location = 0) out vec4 outColor;
  #if LOCATION_NORMAL >= 0
    layout (location = LOCATION_NORMAL) out vec4 outNormal;
  #endif
  #if LOCATION_EMISSIVE >= 0
    layout (location = LOCATION_EMISSIVE) out vec4 outEmissive;
  #endif
#endif
`;
const assignment = /* glsl */ `
#if (__VERSION__ >= 300)
  outColor = FragData[0];

  #if LOCATION_NORMAL >= 0
    outNormal = FragData[LOCATION_NORMAL];
  #endif
  #if LOCATION_EMISSIVE >= 0
    outEmissive = FragData[LOCATION_EMISSIVE];
  #endif
#endif
`;

var output_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  assignment: assignment,
  frag: frag,
  vert: vert
});

const HALF_PI = /* glsl */ `
const float HALF_PI = 1.57079632679;
`;
const PI = /* glsl */ `
const float PI = 3.14159265359;
`;
const TWO_PI = /* glsl */ `
const float TWO_PI = 6.28318530718;
`;
const saturate = /* glsl */ `
#define MEDIUMP_FLT_MAX    65504.0
#define MEDIUMP_FLT_MIN    0.00006103515625

// Could be 1e-5 on Desktop
#define FLT_EPS            MEDIUMP_FLT_MIN

// Could be NOP on desktop
#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
vec4 saturate(vec4 x) { return clamp(x, 0.0, 1.0); }
`;
const round = /* glsl */ `
#if (__VERSION__ < 300)
float round(float f) {
  return f < 0.5 ? floor(f) : ceil(f);
}

vec2 round(vec2 v) {
  v.x = round(v.x);
  v.y = round(v.y);
  return v;
}
#endif
`;
const quatToMat4 = /* glsl */ `
mat4 quatToMat4(vec4 q) {
  float xs = q.x + q.x;
  float ys = q.y + q.y;
  float zs = q.z + q.z;
  float wx = q.w * xs;
  float wy = q.w * ys;
  float wz = q.w * zs;
  float xx = q.x * xs;
  float xy = q.x * ys;
  float xz = q.x * zs;
  float yy = q.y * ys;
  float yz = q.y * zs;
  float zz = q.z * zs;

  return mat4(
    1.0 - (yy + zz), xy + wz, xz - wy, 0.0,
    xy - wz, 1.0 - (xx + zz), yz + wx, 0.0,
    xz + wy, yz - wx, 1.0 - (xx + yy), 0.0,
    0.0, 0.0, 0.0, 1.0
  );
}
`;
const multQuat = /* glsl */ `
vec3 multQuat(vec3 a, vec4 q){
  float x = a.x;
  float y = a.y;
  float z = a.z;

  float qx = q.x;
  float qy = q.y;
  float qz = q.z;
  float qw = q.w;

  float ix =  qw * x + qy * z - qz * y;
  float iy =  qw * y + qz * x - qx * z;
  float iz =  qw * z + qx * y - qy * x;
  float iw = -qx * x - qy * y - qz * z;

  a.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  a.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  a.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;

  return a;
}
`;
// Transpose
// const transposeFloat = /* glsl */`
// float transpose(float m) {
//   return m;
// }`
// const transposeMat2 = /* glsl */`
// mat2 transpose(mat2 m) {
//   return mat2(m[0][0], m[1][0],
//               m[0][1], m[1][1]);
// }`
const transposeMat3 = /* glsl */ `
#if (__VERSION__ < 300)
mat3 transpose(mat3 m) {
  return mat3(
    m[0][0], m[1][0], m[2][0],
    m[0][1], m[1][1], m[2][1],
    m[0][2], m[1][2], m[2][2]
  );
}
#endif
`;
// const transposeMat4 = /* glsl */ `
// #if (__VERSION__ < 300)
// mat4 transpose(mat4 m) {
//   return mat4(
//     m[0][0], m[1][0], m[2][0], m[3][0],
//     m[0][1], m[1][1], m[2][1], m[3][1],
//     m[0][2], m[1][2], m[2][2], m[3][2],
//     m[0][3], m[1][3], m[2][3], m[3][3]
//   );
// }
// #endif
// `;
// Inverse
// const inverseFloat = /* glsl */`
// float inverse(float m) {
//   return 1.0 / m;
// }`
// const inverseMat2 = /* glsl */`
// mat2 inverse(mat2 m) {
//   return mat2(m[1][1],-m[0][1],
//              -m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
// }`
// const inverseMat3 = /* glsl */`
// mat3 inverse(mat3 m) {
//   float a00 = m[0][0], a01 = m[0][1], a02 = m[0][2];
//   float a10 = m[1][0], a11 = m[1][1], a12 = m[1][2];
//   float a20 = m[2][0], a21 = m[2][1], a22 = m[2][2];
//   float b01 = a22 * a11 - a12 * a21;
//   float b11 = -a22 * a10 + a12 * a20;
//   float b21 = a21 * a10 - a11 * a20;
//   float det = a00 * b01 + a01 * b11 + a02 * b21;
//   return mat3(b01, (-a22 * a01 + a02 * a21), (a12 * a01 - a02 * a11),
//               b11, (a22 * a00 - a02 * a20), (-a12 * a00 + a02 * a10),
//               b21, (-a21 * a00 + a01 * a20), (a11 * a00 - a01 * a10)) / det;
// }`
const inverseMat4 = /* glsl */ `
#if (__VERSION__ < 300)
mat4 inverse(mat4 m) {
  float
      a00 = m[0][0], a01 = m[0][1], a02 = m[0][2], a03 = m[0][3],
      a10 = m[1][0], a11 = m[1][1], a12 = m[1][2], a13 = m[1][3],
      a20 = m[2][0], a21 = m[2][1], a22 = m[2][2], a23 = m[2][3],
      a30 = m[3][0], a31 = m[3][1], a32 = m[3][2], a33 = m[3][3],

      b00 = a00 * a11 - a01 * a10,
      b01 = a00 * a12 - a02 * a10,
      b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11,
      b04 = a01 * a13 - a03 * a11,
      b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30,
      b07 = a20 * a32 - a22 * a30,
      b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31,
      b10 = a21 * a33 - a23 * a31,
      b11 = a22 * a33 - a23 * a32,

      det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  return mat4(
      a11 * b11 - a12 * b10 + a13 * b09,
      a02 * b10 - a01 * b11 - a03 * b09,
      a31 * b05 - a32 * b04 + a33 * b03,
      a22 * b04 - a21 * b05 - a23 * b03,
      a12 * b08 - a10 * b11 - a13 * b07,
      a00 * b11 - a02 * b08 + a03 * b07,
      a32 * b02 - a30 * b05 - a33 * b01,
      a20 * b05 - a22 * b02 + a23 * b01,
      a10 * b10 - a11 * b08 + a13 * b06,
      a01 * b08 - a00 * b10 - a03 * b06,
      a30 * b04 - a31 * b02 + a33 * b00,
      a21 * b02 - a20 * b04 - a23 * b00,
      a11 * b07 - a10 * b09 - a12 * b06,
      a00 * b09 - a01 * b07 + a02 * b06,
      a31 * b01 - a30 * b03 - a32 * b00,
      a20 * b03 - a21 * b01 + a22 * b00) / det;
}
#endif
`;
const random = /* glsl */ `
float rand(vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898, 78.233))) * 43758.5453); // * 1231534.9);
}
`;
const max3 = /* glsl */ `
float max3(vec3 v) {
  return max(max(v.x, v.y), v.z);
}
`;

var math_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  HALF_PI: HALF_PI,
  PI: PI,
  TWO_PI: TWO_PI,
  inverseMat4: inverseMat4,
  max3: max3,
  multQuat: multQuat,
  quatToMat4: quatToMat4,
  random: random,
  round: round,
  saturate: saturate,
  transposeMat3: transposeMat3
});

/**
 * Reference Implementation: https://github.com/stegu/webgl-noise
 *
 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
 * Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)
 *
 * @alias module:chunks.noise
 * @type {object}
 */ const common = /* glsl */ `
float mod289(float x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

float permute(float x) {
  return mod289(((x * 34.0) + 10.0) * x);
}
vec3 permute(vec3 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}
vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}

float taylorInvSqrt(float r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

vec2 fade(vec2 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec3 fade(vec3 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}
vec4 fade(vec4 t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec4 grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;

  return p;
}

// (sqrt(5) - 1)/4 = F4, used once below
#define F4 0.309016994374947451
`;
const perlin = /* glsl */ `
// 2D
// Classic Perlin noise
float cnoise(vec2 P)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod289(Pi); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// Classic Perlin noise, periodic variant
float pnoise(vec2 P, vec2 rep)
{
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, rep.xyxy); // To create noise with explicit period
  Pi = mod289(Pi);        // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;

  vec4 i = permute(permute(ix) + iy);

  vec4 gx = fract(i * (1.0 / 41.0)) * 2.0 - 1.0 ;
  vec4 gy = abs(gx) - 0.5 ;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;

  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);

  vec4 norm = taylorInvSqrt(vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11)));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;

  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));

  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// 3D
// Classic Perlin noise
float cnoise(vec3 P)
{
  vec3 Pi0 = floor(P); // Integer part for indexing
  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}

// Classic Perlin noise, periodic variant
float pnoise(vec3 P, vec3 rep)
{
  vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P); // Fractional part for interpolation
  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);

  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);

  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);

  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);

  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
  return 2.2 * n_xyz;
}
// 4D
// Classic Perlin noise
float cnoise(vec4 P)
{
  vec4 Pi0 = floor(P); // Integer part for indexing
  vec4 Pi1 = Pi0 + 1.0; // Integer part + 1
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec4 Pf0 = fract(P); // Fractional part for interpolation
  vec4 Pf1 = Pf0 - 1.0; // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.zzzz);
  vec4 iz1 = vec4(Pi1.zzzz);
  vec4 iw0 = vec4(Pi0.wwww);
  vec4 iw1 = vec4(Pi1.wwww);

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 ixy00 = permute(ixy0 + iw0);
  vec4 ixy01 = permute(ixy0 + iw1);
  vec4 ixy10 = permute(ixy1 + iw0);
  vec4 ixy11 = permute(ixy1 + iw1);

  vec4 gx00 = ixy00 * (1.0 / 7.0);
  vec4 gy00 = floor(gx00) * (1.0 / 7.0);
  vec4 gz00 = floor(gy00) * (1.0 / 6.0);
  gx00 = fract(gx00) - 0.5;
  gy00 = fract(gy00) - 0.5;
  gz00 = fract(gz00) - 0.5;
  vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
  vec4 sw00 = step(gw00, vec4(0.0));
  gx00 -= sw00 * (step(0.0, gx00) - 0.5);
  gy00 -= sw00 * (step(0.0, gy00) - 0.5);

  vec4 gx01 = ixy01 * (1.0 / 7.0);
  vec4 gy01 = floor(gx01) * (1.0 / 7.0);
  vec4 gz01 = floor(gy01) * (1.0 / 6.0);
  gx01 = fract(gx01) - 0.5;
  gy01 = fract(gy01) - 0.5;
  gz01 = fract(gz01) - 0.5;
  vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
  vec4 sw01 = step(gw01, vec4(0.0));
  gx01 -= sw01 * (step(0.0, gx01) - 0.5);
  gy01 -= sw01 * (step(0.0, gy01) - 0.5);

  vec4 gx10 = ixy10 * (1.0 / 7.0);
  vec4 gy10 = floor(gx10) * (1.0 / 7.0);
  vec4 gz10 = floor(gy10) * (1.0 / 6.0);
  gx10 = fract(gx10) - 0.5;
  gy10 = fract(gy10) - 0.5;
  gz10 = fract(gz10) - 0.5;
  vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
  vec4 sw10 = step(gw10, vec4(0.0));
  gx10 -= sw10 * (step(0.0, gx10) - 0.5);
  gy10 -= sw10 * (step(0.0, gy10) - 0.5);

  vec4 gx11 = ixy11 * (1.0 / 7.0);
  vec4 gy11 = floor(gx11) * (1.0 / 7.0);
  vec4 gz11 = floor(gy11) * (1.0 / 6.0);
  gx11 = fract(gx11) - 0.5;
  gy11 = fract(gy11) - 0.5;
  gz11 = fract(gz11) - 0.5;
  vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
  vec4 sw11 = step(gw11, vec4(0.0));
  gx11 -= sw11 * (step(0.0, gx11) - 0.5);
  gy11 -= sw11 * (step(0.0, gy11) - 0.5);

  vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);
  vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);
  vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);
  vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);
  vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);
  vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);
  vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);
  vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);
  vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);
  vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);
  vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);
  vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);
  vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);
  vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);
  vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);
  vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);

  vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
  g0000 *= norm00.x;
  g0100 *= norm00.y;
  g1000 *= norm00.z;
  g1100 *= norm00.w;

  vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
  g0001 *= norm01.x;
  g0101 *= norm01.y;
  g1001 *= norm01.z;
  g1101 *= norm01.w;

  vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
  g0010 *= norm10.x;
  g0110 *= norm10.y;
  g1010 *= norm10.z;
  g1110 *= norm10.w;

  vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
  g0011 *= norm11.x;
  g0111 *= norm11.y;
  g1011 *= norm11.z;
  g1111 *= norm11.w;

  float n0000 = dot(g0000, Pf0);
  float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
  float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
  float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
  float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
  float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
  float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
  float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
  float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
  float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
  float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
  float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
  float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
  float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
  float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
  float n1111 = dot(g1111, Pf1);

  vec4 fade_xyzw = fade(Pf0);
  vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
  vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
  vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
  vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
  float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
  return 2.2 * n_xyzw;
}

// Classic Perlin noise, periodic version
float pnoise(vec4 P, vec4 rep)
{
  vec4 Pi0 = mod(floor(P), rep); // Integer part modulo rep
  vec4 Pi1 = mod(Pi0 + 1.0, rep); // Integer part + 1 mod rep
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec4 Pf0 = fract(P); // Fractional part for interpolation
  vec4 Pf1 = Pf0 - 1.0; // Fractional part - 1.0
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = vec4(Pi0.zzzz);
  vec4 iz1 = vec4(Pi1.zzzz);
  vec4 iw0 = vec4(Pi0.wwww);
  vec4 iw1 = vec4(Pi1.wwww);

  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 ixy00 = permute(ixy0 + iw0);
  vec4 ixy01 = permute(ixy0 + iw1);
  vec4 ixy10 = permute(ixy1 + iw0);
  vec4 ixy11 = permute(ixy1 + iw1);

  vec4 gx00 = ixy00 * (1.0 / 7.0);
  vec4 gy00 = floor(gx00) * (1.0 / 7.0);
  vec4 gz00 = floor(gy00) * (1.0 / 6.0);
  gx00 = fract(gx00) - 0.5;
  gy00 = fract(gy00) - 0.5;
  gz00 = fract(gz00) - 0.5;
  vec4 gw00 = vec4(0.75) - abs(gx00) - abs(gy00) - abs(gz00);
  vec4 sw00 = step(gw00, vec4(0.0));
  gx00 -= sw00 * (step(0.0, gx00) - 0.5);
  gy00 -= sw00 * (step(0.0, gy00) - 0.5);

  vec4 gx01 = ixy01 * (1.0 / 7.0);
  vec4 gy01 = floor(gx01) * (1.0 / 7.0);
  vec4 gz01 = floor(gy01) * (1.0 / 6.0);
  gx01 = fract(gx01) - 0.5;
  gy01 = fract(gy01) - 0.5;
  gz01 = fract(gz01) - 0.5;
  vec4 gw01 = vec4(0.75) - abs(gx01) - abs(gy01) - abs(gz01);
  vec4 sw01 = step(gw01, vec4(0.0));
  gx01 -= sw01 * (step(0.0, gx01) - 0.5);
  gy01 -= sw01 * (step(0.0, gy01) - 0.5);

  vec4 gx10 = ixy10 * (1.0 / 7.0);
  vec4 gy10 = floor(gx10) * (1.0 / 7.0);
  vec4 gz10 = floor(gy10) * (1.0 / 6.0);
  gx10 = fract(gx10) - 0.5;
  gy10 = fract(gy10) - 0.5;
  gz10 = fract(gz10) - 0.5;
  vec4 gw10 = vec4(0.75) - abs(gx10) - abs(gy10) - abs(gz10);
  vec4 sw10 = step(gw10, vec4(0.0));
  gx10 -= sw10 * (step(0.0, gx10) - 0.5);
  gy10 -= sw10 * (step(0.0, gy10) - 0.5);

  vec4 gx11 = ixy11 * (1.0 / 7.0);
  vec4 gy11 = floor(gx11) * (1.0 / 7.0);
  vec4 gz11 = floor(gy11) * (1.0 / 6.0);
  gx11 = fract(gx11) - 0.5;
  gy11 = fract(gy11) - 0.5;
  gz11 = fract(gz11) - 0.5;
  vec4 gw11 = vec4(0.75) - abs(gx11) - abs(gy11) - abs(gz11);
  vec4 sw11 = step(gw11, vec4(0.0));
  gx11 -= sw11 * (step(0.0, gx11) - 0.5);
  gy11 -= sw11 * (step(0.0, gy11) - 0.5);

  vec4 g0000 = vec4(gx00.x,gy00.x,gz00.x,gw00.x);
  vec4 g1000 = vec4(gx00.y,gy00.y,gz00.y,gw00.y);
  vec4 g0100 = vec4(gx00.z,gy00.z,gz00.z,gw00.z);
  vec4 g1100 = vec4(gx00.w,gy00.w,gz00.w,gw00.w);
  vec4 g0010 = vec4(gx10.x,gy10.x,gz10.x,gw10.x);
  vec4 g1010 = vec4(gx10.y,gy10.y,gz10.y,gw10.y);
  vec4 g0110 = vec4(gx10.z,gy10.z,gz10.z,gw10.z);
  vec4 g1110 = vec4(gx10.w,gy10.w,gz10.w,gw10.w);
  vec4 g0001 = vec4(gx01.x,gy01.x,gz01.x,gw01.x);
  vec4 g1001 = vec4(gx01.y,gy01.y,gz01.y,gw01.y);
  vec4 g0101 = vec4(gx01.z,gy01.z,gz01.z,gw01.z);
  vec4 g1101 = vec4(gx01.w,gy01.w,gz01.w,gw01.w);
  vec4 g0011 = vec4(gx11.x,gy11.x,gz11.x,gw11.x);
  vec4 g1011 = vec4(gx11.y,gy11.y,gz11.y,gw11.y);
  vec4 g0111 = vec4(gx11.z,gy11.z,gz11.z,gw11.z);
  vec4 g1111 = vec4(gx11.w,gy11.w,gz11.w,gw11.w);

  vec4 norm00 = taylorInvSqrt(vec4(dot(g0000, g0000), dot(g0100, g0100), dot(g1000, g1000), dot(g1100, g1100)));
  g0000 *= norm00.x;
  g0100 *= norm00.y;
  g1000 *= norm00.z;
  g1100 *= norm00.w;

  vec4 norm01 = taylorInvSqrt(vec4(dot(g0001, g0001), dot(g0101, g0101), dot(g1001, g1001), dot(g1101, g1101)));
  g0001 *= norm01.x;
  g0101 *= norm01.y;
  g1001 *= norm01.z;
  g1101 *= norm01.w;

  vec4 norm10 = taylorInvSqrt(vec4(dot(g0010, g0010), dot(g0110, g0110), dot(g1010, g1010), dot(g1110, g1110)));
  g0010 *= norm10.x;
  g0110 *= norm10.y;
  g1010 *= norm10.z;
  g1110 *= norm10.w;

  vec4 norm11 = taylorInvSqrt(vec4(dot(g0011, g0011), dot(g0111, g0111), dot(g1011, g1011), dot(g1111, g1111)));
  g0011 *= norm11.x;
  g0111 *= norm11.y;
  g1011 *= norm11.z;
  g1111 *= norm11.w;

  float n0000 = dot(g0000, Pf0);
  float n1000 = dot(g1000, vec4(Pf1.x, Pf0.yzw));
  float n0100 = dot(g0100, vec4(Pf0.x, Pf1.y, Pf0.zw));
  float n1100 = dot(g1100, vec4(Pf1.xy, Pf0.zw));
  float n0010 = dot(g0010, vec4(Pf0.xy, Pf1.z, Pf0.w));
  float n1010 = dot(g1010, vec4(Pf1.x, Pf0.y, Pf1.z, Pf0.w));
  float n0110 = dot(g0110, vec4(Pf0.x, Pf1.yz, Pf0.w));
  float n1110 = dot(g1110, vec4(Pf1.xyz, Pf0.w));
  float n0001 = dot(g0001, vec4(Pf0.xyz, Pf1.w));
  float n1001 = dot(g1001, vec4(Pf1.x, Pf0.yz, Pf1.w));
  float n0101 = dot(g0101, vec4(Pf0.x, Pf1.y, Pf0.z, Pf1.w));
  float n1101 = dot(g1101, vec4(Pf1.xy, Pf0.z, Pf1.w));
  float n0011 = dot(g0011, vec4(Pf0.xy, Pf1.zw));
  float n1011 = dot(g1011, vec4(Pf1.x, Pf0.y, Pf1.zw));
  float n0111 = dot(g0111, vec4(Pf0.x, Pf1.yzw));
  float n1111 = dot(g1111, Pf1);

  vec4 fade_xyzw = fade(Pf0);
  vec4 n_0w = mix(vec4(n0000, n1000, n0100, n1100), vec4(n0001, n1001, n0101, n1101), fade_xyzw.w);
  vec4 n_1w = mix(vec4(n0010, n1010, n0110, n1110), vec4(n0011, n1011, n0111, n1111), fade_xyzw.w);
  vec4 n_zw = mix(n_0w, n_1w, fade_xyzw.z);
  vec2 n_yzw = mix(n_zw.xy, n_zw.zw, fade_xyzw.y);
  float n_xyzw = mix(n_yzw.x, n_yzw.y, fade_xyzw.x);
  return 2.2 * n_xyzw;
}
`;
const simplex = /* glsl */ `
// 2D
float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// 3D
float snoise(vec3 v)
  {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                dot(p2,x2), dot(p3,x3) ) );
}

// 4D
float snoise(vec4 v)
  {
  const vec4  C = vec4( 0.138196601125011,  // (5 - sqrt(5))/20  G4
                        0.276393202250021,  // 2 * G4
                        0.414589803375032,  // 3 * G4
                       -0.447213595499958); // -1 + 4 * G4

// First corner
  vec4 i  = floor(v + dot(v, vec4(F4)) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

// Other corners

// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
  vec4 i0;
  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
//  i0.x = dot( isX, vec3( 1.0 ) );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;
//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;
  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  // i0 now contains the unique values 0,1,2,3 in each channel
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  //  x0 = x0 - 0.0 + 0.0 * C.xxxx
  //  x1 = x0 - i1  + 1.0 * C.xxxx
  //  x2 = x0 - i2  + 2.0 * C.xxxx
  //  x3 = x0 - i3  + 3.0 * C.xxxx
  //  x4 = x0 - 1.0 + 4.0 * C.xxxx
  vec4 x1 = x0 - i1 + C.xxxx;
  vec4 x2 = x0 - i2 + C.yyyy;
  vec4 x3 = x0 - i3 + C.zzzz;
  vec4 x4 = x0 + C.wwww;

// Permutations
  i = mod289(i);
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));

// Gradients: 7x7x6 points over a cube, mapped onto a 4-cross polytope
// 7*7*6 = 294, which is close to the ring size 17*17 = 289.
  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

// Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

// Mix contributions from the five corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}
`;

var noise_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  common: common,
  perlin: perlin,
  simplex: simplex
});

var encodeDecode_glsl = /* glsl */ `
#define LINEAR 1
#define GAMMA 2
#define SRGB 3

const float gamma = 2.2;

// Linear
float toLinear(float v) {
  return pow(v, gamma);
}

vec2 toLinear(vec2 v) {
  return pow(v, vec2(gamma));
}

vec3 toLinear(vec3 v) {
  return pow(v, vec3(gamma));
}

vec4 toLinear(vec4 v) {
  return vec4(toLinear(v.rgb), v.a);
}

// Gamma
float toGamma(float v) {
  return pow(v, 1.0 / gamma);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  return pixel;
}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  return pixel;
}
`;

// ITU-R BT.601
// Assumes linear color
var luma_glsl = /* glsl */ `
float luma(in vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}
`;

// ITU-R BT.709-2
var luminance_glsl = /* glsl */ `
float luminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
`;

var average_glsl = /* glsl */ `
float average(vec3 color) {
  return (color.r + color.g + color.b) / 3.0;
}
`;

var lightAmbient_glsl = /* glsl */ `
#if NUM_AMBIENT_LIGHTS > 0

struct AmbientLight {
  vec4 color;
};

uniform AmbientLight uAmbientLights[NUM_AMBIENT_LIGHTS];

void EvaluateAmbientLight(inout PBRData data, AmbientLight light, float ao) {
  vec3 lightColor = decode(light.color, SRGB).rgb;
  lightColor *= light.color.a;
  data.indirectDiffuse += ao * (data.diffuseColor * lightColor);
}
#endif
`;

var lightDirectional_glsl = /* glsl */ `
#if NUM_DIRECTIONAL_LIGHTS > 0

struct DirectionalLight {
  vec3 direction;
  vec4 color;
  mat4 projectionMatrix;
  mat4 viewMatrix;
  bool castShadows;
  float near;
  float far;
  float bias;
  vec2 radiusUV;
  vec2 shadowMapSize;
};

uniform DirectionalLight uDirectionalLights[NUM_DIRECTIONAL_LIGHTS];
uniform sampler2D uDirectionalLightShadowMaps[NUM_DIRECTIONAL_LIGHTS]; //TODO: is it ok to sample depth texture as sampler2D?

void EvaluateDirectionalLight(inout PBRData data, DirectionalLight light, sampler2D shadowMap) {
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0);
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec3 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xyz / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = bool(light.castShadows)
    ? getShadow(
        shadowMap,
        light.shadowMapSize,
        lightUV,
        lightDistView - light.bias,
        light.near,
        light.far,
        lightDeviceCoordsPositionNormalized.z,
        light.radiusUV
      )
    : 1.0;

  if (illuminated > 0.0) {
    Light l;
    l.l = -light.direction;
    l.color = light.color;
    l.attenuation = 1.0;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`;

var lightPoint_glsl = /* glsl */ `
#if NUM_POINT_LIGHTS > 0

struct PointLight {
  vec3 position;
  vec4 color;
  float range;
  bool castShadows;
  float bias;
  float radius;
  vec2 shadowMapSize;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];
uniform samplerCube uPointLightShadowMaps[NUM_POINT_LIGHTS];

void EvaluatePointLight(inout PBRData data, PointLight light, samplerCube shadowMap) {
  vec3 positionToLightWorld = data.positionWorld - light.position;
  float lightDistWorld = length(positionToLightWorld);

  float illuminated = bool(light.castShadows)
    ? getPunctualShadow(shadowMap, light.shadowMapSize, positionToLightWorld, lightDistWorld - light.bias, light.radius)
    : 1.0;

  if (illuminated > 0.0) {
    float invSqrFalloff = 1.0 / pow(light.range, 2.0);
    float attenuation = getDistanceAttenuation(positionToLightWorld, invSqrFalloff);

    Light l;
    l.l = -normalize(positionToLightWorld);
    l.color = light.color;
    l.attenuation = attenuation;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`;

var lightSpot_glsl = /* glsl */ `
#if NUM_SPOT_LIGHTS > 0

struct SpotLight {
  vec3 position;
  vec3 direction;
  vec4 color;
  float innerAngle;
  float angle;
  float range;
  mat4 projectionMatrix;
  mat4 viewMatrix;
  bool castShadows;
  float near;
  float far;
  float bias;
  vec2 radiusUV;
  vec2 shadowMapSize;
};

uniform SpotLight uSpotLights[NUM_SPOT_LIGHTS];
uniform sampler2D uSpotLightShadowMaps[NUM_SPOT_LIGHTS];

void EvaluateSpotLight(inout PBRData data, SpotLight light, sampler2D shadowMap) {
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0); // TODO: move in the vertex shader
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec3 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xyz / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = bool(light.castShadows)
    ? getShadow(
        shadowMap,
        light.shadowMapSize,
        lightUV,
        lightDistView - light.bias,
        light.near,
        light.far,
        lightDeviceCoordsPositionNormalized.z,
        light.radiusUV
      )
    : 1.0;

  if (illuminated > 0.0) {
    vec3 posToLight = light.position - data.positionWorld;

    float invSqrFalloff = 1.0 / pow(light.range, 2.0);
    float attenuation = getDistanceAttenuation(posToLight, invSqrFalloff);

    // TODO: luminous power to intensity
    float cosOuter = cos(light.angle);
    float cosInner = cos(light.innerAngle);
    float scale = 1.0 / max(1.0 / 1024.0, cosInner - cosOuter);
    float offset = -cosOuter * scale;

    vec2 scaleOffset = vec2(scale, offset);
    attenuation *= getAngleAttenuation(-light.direction, normalize(posToLight), scaleOffset);

    Light l;
    l.l = normalize(posToLight);
    l.color = light.color;
    l.attenuation = attenuation;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`;

// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines.
// Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt.
// ACM Transactions on Graphics (Proceedings of ACM SIGGRAPH 2016) 35(4), 2016.
// Project page: https://eheitzresearch.wordpress.com/415-2/
var lightArea_glsl = /* glsl */ `
#if NUM_AREA_LIGHTS > 0

struct AreaLight {
  vec3 position;
  vec4 color;
  vec4 rotation;
  vec2 size;
  bool disk;
  bool doubleSided;

  mat4 projectionMatrix;
  mat4 viewMatrix;
  bool castShadows;
  float near;
  float far;
  float bias;
  vec2 radiusUV;
  vec2 shadowMapSize;
};

uniform AreaLight uAreaLights[NUM_AREA_LIGHTS];
uniform sampler2D uAreaLightShadowMaps[NUM_AREA_LIGHTS];

const bool clipless = false;
const bool groundTruth = false;

uniform sampler2D ltc_1;
uniform sampler2D ltc_2;

const float LUT_SIZE  = 64.0;
const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
const float LUT_BIAS  = 0.5/LUT_SIZE;

// Disk
const int NUM_SAMPLES = 8;
const int sampleCount = 4;
const float pi = 3.14159265;
const float NO_HIT = 1e9;

struct Ray
{
    vec3 origin;
    vec3 dir;
};

struct Disk
{
    vec3  center;
    vec3  dirx;
    vec3  diry;
    float halfx;
    float halfy;

    vec4  plane;
};

float RayPlaneIntersect(Ray ray, vec4 plane)
{
    float t = -dot(plane, vec4(ray.origin, 1.0))/dot(plane.xyz, ray.dir);
    return (t > 0.0) ? t : NO_HIT;
}

float sqr(float x) { return x*x; }

float RayDiskIntersect(Ray ray, Disk disk)
{
    float t = RayPlaneIntersect(ray, disk.plane);
    if (t != NO_HIT)
    {
        vec3 pos  = ray.origin + ray.dir*t;
        vec3 lpos = pos - disk.center;

        float x = dot(lpos, disk.dirx);
        float y = dot(lpos, disk.diry);

        if (sqr(x/disk.halfx) + sqr(y/disk.halfy) > 1.0)
            t = NO_HIT;
    }

    return t;
}

mat3 mat3_from_columns(vec3 c0, vec3 c1, vec3 c2)
{
    mat3 m = mat3(c0, c1, c2);
    return m;
}

float Halton(int index, float base)
{
    float result = 0.0;
    float f = 1.0/base;
    float i = float(index);
    for (int x = 0; x < 8; x++)
    {
        if (i <= 0.0) break;

        result += f*mod(i, base);
        i = floor(i/base);
        f = f/base;
    }

    return result;
}

void Halton2D(out vec2 s[NUM_SAMPLES], int offset)
{
    for (int i = 0; i < NUM_SAMPLES; i++)
    {
        s[i].x = Halton(i + offset, 2.0);
        s[i].y = Halton(i + offset, 3.0);
    }
}

Disk InitDisk(vec3 center, vec3 dirx, vec3 diry, float halfx, float halfy)
{
    Disk disk;

    disk.center = center;
    disk.dirx   = dirx;
    disk.diry   = diry;
    disk.halfx  = halfx;
    disk.halfy  = halfy;

    vec3 diskNormal = cross(disk.dirx, disk.diry);
    disk.plane = vec4(diskNormal, -dot(diskNormal, disk.center));

    return disk;
}

// An extended version of the implementation from
// "How to solve a cubic equation, revisited"
// http://momentsingraphics.de/?p=105
vec3 SolveCubic(vec4 Coefficient)
{
    // Normalize the polynomial
    Coefficient.xyz /= Coefficient.w;
    // Divide middle coefficients by three
    Coefficient.yz /= 3.0;

    float A = Coefficient.w;
    float B = Coefficient.z;
    float C = Coefficient.y;
    float D = Coefficient.x;

    // Compute the Hessian and the discriminant
    vec3 Delta = vec3(
        -Coefficient.z*Coefficient.z + Coefficient.y,
        -Coefficient.y*Coefficient.z + Coefficient.x,
        dot(vec2(Coefficient.z, -Coefficient.y), Coefficient.xy)
    );

    float Discriminant = dot(vec2(4.0*Delta.x, -Delta.y), Delta.zy);

    vec3 RootsA, RootsD;

    vec2 xlc, xsc;

    // Algorithm A
    {
        float A_a = 1.0;
        float C_a = Delta.x;
        float D_a = -2.0*B*Delta.x + Delta.y;

        // Take the cubic root of a normalized complex number
        float Theta = atan(sqrt(Discriminant), -D_a)/3.0;

        float x_1a = 2.0*sqrt(-C_a)*cos(Theta);
        float x_3a = 2.0*sqrt(-C_a)*cos(Theta + (2.0/3.0)*pi);

        float xl;
        if ((x_1a + x_3a) > 2.0*B)
            xl = x_1a;
        else
            xl = x_3a;

        xlc = vec2(xl - B, A);
    }

    // Algorithm D
    {
        float A_d = D;
        float C_d = Delta.z;
        float D_d = -D*Delta.y + 2.0*C*Delta.z;

        // Take the cubic root of a normalized complex number
        float Theta = atan(D*sqrt(Discriminant), -D_d)/3.0;

        float x_1d = 2.0*sqrt(-C_d)*cos(Theta);
        float x_3d = 2.0*sqrt(-C_d)*cos(Theta + (2.0/3.0)*pi);

        float xs;
        if (x_1d + x_3d < 2.0*C)
            xs = x_1d;
        else
            xs = x_3d;

        xsc = vec2(-D, xs + C);
    }

    float E =  xlc.y*xsc.y;
    float F = -xlc.x*xsc.y - xlc.y*xsc.x;
    float G =  xlc.x*xsc.x;

    vec2 xmc = vec2(C*F - B*G, -B*F + C*E);

    vec3 Root = vec3(xsc.x/xsc.y, xmc.x/xmc.y, xlc.x/xlc.y);

    if (Root.x < Root.y && Root.x < Root.z)
        Root.xyz = Root.yxz;
    else if (Root.z < Root.x && Root.z < Root.y)
        Root.xyz = Root.xzy;

    return Root;
}

vec3 LTC_Evaluate(
    vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4], bool twoSided, float u1, float u2)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N*dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, N) basis
    mat3 R = transpose(mat3(T1, T2, N));

    // polygon (allocate 5 vertices for clipping)
    vec3 L_[3];
    L_[0] = R * (points[0] - P);
    L_[1] = R * (points[1] - P);
    L_[2] = R * (points[2] - P);

    vec3 Lo_i = vec3(0);

    // init ellipse
    vec3 C  = 0.5 * (L_[0] + L_[2]);
    vec3 V1 = 0.5 * (L_[1] - L_[2]);
    vec3 V2 = 0.5 * (L_[1] - L_[0]);

    C  = Minv * C;
    V1 = Minv * V1;
    V2 = Minv * V2;

    if(!twoSided && dot(cross(V1, V2), C) < 0.0)
        return vec3(0.0);

    // compute eigenvectors of ellipse
    float a, b;
    float d11 = dot(V1, V1);
    float d22 = dot(V2, V2);
    float d12 = dot(V1, V2);
    if (abs(d12)/sqrt(d11*d22) > 0.0001)
    {
        float tr = d11 + d22;
        float det = -d12*d12 + d11*d22;

        // use sqrt matrix to solve for eigenvalues
        det = sqrt(det);
        float u = 0.5*sqrt(tr - 2.0*det);
        float v = 0.5*sqrt(tr + 2.0*det);
        float e_max = sqr(u + v);
        float e_min = sqr(u - v);

        vec3 V1_, V2_;

        if (d11 > d22)
        {
            V1_ = d12*V1 + (e_max - d11)*V2;
            V2_ = d12*V1 + (e_min - d11)*V2;
        }
        else
        {
            V1_ = d12*V2 + (e_max - d22)*V1;
            V2_ = d12*V2 + (e_min - d22)*V1;
        }

        a = 1.0 / e_max;
        b = 1.0 / e_min;
        V1 = normalize(V1_);
        V2 = normalize(V2_);
    }
    else
    {
        a = 1.0 / dot(V1, V1);
        b = 1.0 / dot(V2, V2);
        V1 *= sqrt(a);
        V2 *= sqrt(b);
    }

    vec3 V3 = cross(V1, V2);
    if (dot(C, V3) < 0.0)
        V3 *= -1.0;

    float L  = dot(V3, C);
    float x0 = dot(V1, C) / L;
    float y0 = dot(V2, C) / L;

    float E1 = inversesqrt(a);
    float E2 = inversesqrt(b);

    a *= L*L;
    b *= L*L;

    float c0 = a*b;
    float c1 = a*b*(1.0 + x0*x0 + y0*y0) - a - b;
    float c2 = 1.0 - a*(1.0 + x0*x0) - b*(1.0 + y0*y0);
    float c3 = 1.0;

    vec3 roots = SolveCubic(vec4(c0, c1, c2, c3));
    float e1 = roots.x;
    float e2 = roots.y;
    float e3 = roots.z;

    vec3 avgDir = vec3(a*x0/(a - e2), b*y0/(b - e2), 1.0);

    mat3 rotate = mat3_from_columns(V1, V2, V3);

    avgDir = rotate*avgDir;
    avgDir = normalize(avgDir);

    float L1 = sqrt(-e2/e3);
    float L2 = sqrt(-e2/e1);

    float formFactor = L1*L2*inversesqrt((1.0 + L1*L1)*(1.0 + L2*L2));

    // use tabulated horizon-clipped sphere
    vec2 uv = vec2(avgDir.z*0.5 + 0.5, formFactor);
    uv = uv*LUT_SCALE + LUT_BIAS;
    float scale = texture2D(ltc_2, uv).w;

    float spec = formFactor*scale;

    if (groundTruth)
    {
        spec = 0.0;

        float diskArea = pi*E1*E2;

        // light sample
        {
            // random point on ellipse
            float rad = sqrt(u1);
            float phi = 2.0*pi*u2;
            float x = E1*rad*cos(phi);
            float y = E2*rad*sin(phi);

            vec3 p = x*V1 + y*V2 + C;
            vec3 v = normalize(p);

            float c2 = max(dot(V3, v), 0.0);
            float solidAngle = max(c2/dot(p, p), 1e-7);
            float pdfLight = 1.0/solidAngle/diskArea;

            float cosTheta = max(v.z, 0.0);
            float brdf = 1.0/pi;
            float pdfBRDF = cosTheta/pi;

            if (cosTheta > 0.0)
                spec += brdf*cosTheta/(pdfBRDF + pdfLight);
        }

        // BRDF sample
        {
            // generate a cosine-distributed direction
            float rad = sqrt(u1);
            float phi = 2.0*pi*u2;
            float x = rad*cos(phi);
            float y = rad*sin(phi);
            vec3 dir = vec3(x, y, sqrt(1.0 - u1));

            Ray ray;
            ray.origin = vec3(0, 0, 0);
            ray.dir = dir;

            Disk disk = InitDisk(C, V1, V2, E1, E2);

            vec3 diskNormal = V3;
            disk.plane = vec4(diskNormal, -dot(diskNormal, disk.center));

            float distToDisk = RayDiskIntersect(ray, disk);
            bool  intersect  = distToDisk != NO_HIT;

            float cosTheta = max(dir.z, 0.0);
            float brdf = 1.0/pi;
            float pdfBRDF = cosTheta/pi;

            float pdfLight = 0.0;
            if (intersect)
            {
                vec3 p = distToDisk*ray.dir;
                vec3 v = normalize(p);
                float c2 = max(dot(V3, v), 0.0);
                float solidAngle = max(c2/dot(p, p), 1e-7);
                pdfLight = 1.0/solidAngle/diskArea;
            }

            if (intersect)
                spec += brdf*cosTheta/(pdfBRDF + pdfLight);
        }
    }

    Lo_i = vec3(spec, spec, spec);

    return vec3(Lo_i);
}

// Quad
vec3 IntegrateEdgeVec(vec3 v1, vec3 v2)
{
    float x = dot(v1, v2);
    float y = abs(x);

    float a = 0.8543985 + (0.4965155 + 0.0145206*y)*y;
    float b = 3.4175940 + (4.1616724 + y)*y;
    float v = a / b;

    float theta_sintheta = (x > 0.0) ? v : 0.5*inversesqrt(max(1.0 - x*x, 1e-7)) - v;

    return cross(v1, v2)*theta_sintheta;
}

float IntegrateEdge(vec3 v1, vec3 v2)
{
    return IntegrateEdgeVec(v1, v2).z;
}

void ClipQuadToHorizon(inout vec3 L[5], out int n)
{
    // detect clipping config
    int config = 0;
    if (L[0].z > 0.0) config += 1;
    if (L[1].z > 0.0) config += 2;
    if (L[2].z > 0.0) config += 4;
    if (L[3].z > 0.0) config += 8;

    // clip
    n = 0;

    if (config == 0)
    {
        // clip all
    }
    else if (config == 1) // V1 clip V2 V3 V4
    {
        n = 3;
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
        L[2] = -L[3].z * L[0] + L[0].z * L[3];
    }
    else if (config == 2) // V2 clip V1 V3 V4
    {
        n = 3;
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
    }
    else if (config == 3) // V1 V2 clip V3 V4
    {
        n = 4;
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
        L[3] = -L[3].z * L[0] + L[0].z * L[3];
    }
    else if (config == 4) // V3 clip V1 V2 V4
    {
        n = 3;
        L[0] = -L[3].z * L[2] + L[2].z * L[3];
        L[1] = -L[1].z * L[2] + L[2].z * L[1];
    }
    else if (config == 5) // V1 V3 clip V2 V4) impossible
    {
        n = 0;
    }
    else if (config == 6) // V2 V3 clip V1 V4
    {
        n = 4;
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
        L[3] = -L[3].z * L[2] + L[2].z * L[3];
    }
    else if (config == 7) // V1 V2 V3 clip V4
    {
        n = 5;
        L[4] = -L[3].z * L[0] + L[0].z * L[3];
        L[3] = -L[3].z * L[2] + L[2].z * L[3];
    }
    else if (config == 8) // V4 clip V1 V2 V3
    {
        n = 3;
        L[0] = -L[0].z * L[3] + L[3].z * L[0];
        L[1] = -L[2].z * L[3] + L[3].z * L[2];
        L[2] =  L[3];
    }
    else if (config == 9) // V1 V4 clip V2 V3
    {
        n = 4;
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
        L[2] = -L[2].z * L[3] + L[3].z * L[2];
    }
    else if (config == 10) // V2 V4 clip V1 V3) impossible
    {
        n = 0;
    }
    else if (config == 11) // V1 V2 V4 clip V3
    {
        n = 5;
        L[4] = L[3];
        L[3] = -L[2].z * L[3] + L[3].z * L[2];
        L[2] = -L[2].z * L[1] + L[1].z * L[2];
    }
    else if (config == 12) // V3 V4 clip V1 V2
    {
        n = 4;
        L[1] = -L[1].z * L[2] + L[2].z * L[1];
        L[0] = -L[0].z * L[3] + L[3].z * L[0];
    }
    else if (config == 13) // V1 V3 V4 clip V2
    {
        n = 5;
        L[4] = L[3];
        L[3] = L[2];
        L[2] = -L[1].z * L[2] + L[2].z * L[1];
        L[1] = -L[1].z * L[0] + L[0].z * L[1];
    }
    else if (config == 14) // V2 V3 V4 clip V1
    {
        n = 5;
        L[4] = -L[0].z * L[3] + L[3].z * L[0];
        L[0] = -L[0].z * L[1] + L[1].z * L[0];
    }
    else if (config == 15) // V1 V2 V3 V4
    {
        n = 4;
    }

    if (n == 3)
        L[3] = L[0];
    if (n == 4)
        L[4] = L[0];
}

vec3 LTC_Evaluate(
    vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4], bool twoSided)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N*dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, N) basis
    Minv = Minv * transpose(mat3(T1, T2, N));

    // polygon (allocate 5 vertices for clipping)
    vec3 L[5];
    L[0] = Minv * (points[0] - P);
    L[1] = Minv * (points[1] - P);
    L[2] = Minv * (points[2] - P);
    L[3] = Minv * (points[3] - P);

    // integrate
    float sum = 0.0;

    if (clipless)
    {
        vec3 dir = points[0].xyz - P;
        vec3 lightNormal = cross(points[1] - points[0], points[3] - points[0]);
        bool behind = (dot(dir, lightNormal) < 0.0);

        L[0] = normalize(L[0]);
        L[1] = normalize(L[1]);
        L[2] = normalize(L[2]);
        L[3] = normalize(L[3]);

        vec3 vsum = vec3(0.0);

        vsum += IntegrateEdgeVec(L[0], L[1]);
        vsum += IntegrateEdgeVec(L[1], L[2]);
        vsum += IntegrateEdgeVec(L[2], L[3]);
        vsum += IntegrateEdgeVec(L[3], L[0]);

        float len = length(vsum);
        float z = vsum.z/len;

        if (behind)
            z = -z;

        vec2 uv = vec2(z*0.5 + 0.5, len);
        uv = uv*LUT_SCALE + LUT_BIAS;

        float scale = texture2D(ltc_2, uv).w;

        sum = len*scale;

        if (behind && !twoSided)
            sum = 0.0;
    }
    else
    {
        int n;
        ClipQuadToHorizon(L, n);

        if (n == 0)
            return vec3(0, 0, 0);
        // project onto sphere
        L[0] = normalize(L[0]);
        L[1] = normalize(L[1]);
        L[2] = normalize(L[2]);
        L[3] = normalize(L[3]);
        L[4] = normalize(L[4]);

        // integrate
        sum += IntegrateEdge(L[0], L[1]);
        sum += IntegrateEdge(L[1], L[2]);
        sum += IntegrateEdge(L[2], L[3]);
        if (n >= 4)
            sum += IntegrateEdge(L[3], L[4]);
        if (n == 5)
            sum += IntegrateEdge(L[4], L[0]);

        sum = twoSided ? abs(sum) : max(0.0, sum);
    }

    vec3 Lo_i = vec3(sum, sum, sum);

    return Lo_i;
}

void EvaluateAreaLight(inout PBRData data, AreaLight light, sampler2D shadowMap, float ao) {
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0); // TODO: move in the vertex shader
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec3 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xyz / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = bool(light.castShadows)
    ? getShadow(
        shadowMap,
        light.shadowMapSize,
        lightUV,
        lightDistView - light.bias,
        light.near,
        light.far,
        lightDeviceCoordsPositionNormalized.z,
        light.radiusUV
      )
    : 1.0;

  if (illuminated > 0.0) {
    vec3 pos = data.positionWorld;
    vec3 N = data.normalWorld;
    vec3 V = -normalize(pos - uCameraPosition);
    float roughness = data.roughness;

    vec3 ex = multQuat(vec3(1, 0, 0), light.rotation) * light.size.x;
    vec3 ey = multQuat(vec3(0, 1, 0), light.rotation) * light.size.y;

    vec3 points[4];
    points[0] = light.position - ex + ey;
    points[1] = light.position + ex + ey;
    points[2] = light.position + ex - ey;
    points[3] = light.position - ex - ey;

    float u1;
    float u2;
    if (light.disk) {
      vec2 seq[NUM_SAMPLES];
      Halton2D(seq, sampleCount);

      u1 = rand(gl_FragCoord.xy*0.01);
      u2 = rand(gl_FragCoord.yx*0.01);

      u1 = fract(u1 + seq[0].x);
      u2 = fract(u2 + seq[0].y);
    }

    float ndotv = saturate(dot(N, V));
    vec2 uv = vec2(roughness, sqrt(1.0 - ndotv));
    uv = uv * LUT_SCALE + LUT_BIAS;

    vec4 t1 = texture2D(ltc_1, uv);
    vec4 t2 = texture2D(ltc_2, uv);

    mat3 Minv = mat3(
      vec3(t1.x, 0, t1.y),
      vec3(  0,  1,    0),
      vec3(t1.z, 0, t1.w)
    );

    vec3 spec = light.disk
      ? LTC_Evaluate(N, V, pos, Minv, points, light.doubleSided, u1, u2)
      : LTC_Evaluate(N, V, pos, Minv, points, light.doubleSided);
    spec *= data.f0 * t2.x + (1.0 - data.f0) * t2.y;

    vec3 diff = light.disk
      ? LTC_Evaluate(N, V, pos, mat3(1), points, light.doubleSided, u1, u2)
      : LTC_Evaluate(N, V, pos, mat3(1), points, light.doubleSided);

    // spec *= scol * t2.x + (1.0 - scol) * t2.y;
    // col = lcol*(spec + dcol*diff);
    // data.indirectSpecular += ao * col;

    spec = max(spec, vec3(0.0));
    diff = max(diff, vec3(0.0));

    #ifdef USE_TRANSMISSION
      diff *= (1.0 - data.transmission);
    #endif

    vec3 lightColor = decode(light.color, SRGB).rgb;
    data.directColor += illuminated * ao * lightColor * data.baseColor * diff;
    data.indirectSpecular += illuminated * ao * lightColor * spec;
  }
}
#endif
`;

const PCF = /* glsl */ `
float texture2DCompare(sampler2D depths, vec2 uv, float compare, float near, float far) {
  float depth = readDepthOrtho(depths, uv, near, far);
  if (depth >= far - DEPTH_TOLERANCE) return 1.0;
  return step(compare, depth);
}

float texture2DShadowLerp(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
  vec2 texelSize = vec2(1.0) / size;
  vec2 f = fract(uv * size + 0.5);
  vec2 centroidUV = floor(uv * size + 0.5) / size;

  float lb = texture2DCompare(depths, centroidUV + texelSize * vec2(0.0, 0.0), compare, near, far);
  float lt = texture2DCompare(depths, centroidUV + texelSize * vec2(0.0, 1.0), compare, near, far);
  float rb = texture2DCompare(depths, centroidUV + texelSize * vec2(1.0, 0.0), compare, near, far);
  float rt = texture2DCompare(depths, centroidUV + texelSize * vec2(1.0, 1.0), compare, near, far);
  float a = mix(lb, lt, f.y);
  float b = mix(rb, rt, f.y);
  float c = mix(a, b, f.x);

  return c;
}

float PCF3x3(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
  float result = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 off = vec2(x, y) / float(size);
      result += texture2DShadowLerp(depths, size, uv + off, compare, near, far);
    }
  }
  return result / 9.0;
}

float PCF5x5(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
  float result = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 off = vec2(x, y) / float(size);
      result += texture2DShadowLerp(depths, size, uv + off, compare, near, far);
    }
  }
  return result / 25.0;
}
`;
const PCFCube = /* glsl */ `
float textureCubeCompare(samplerCube depths, vec3 direction, float compare) {
  float depth = unpackDepth(textureCube(depths, direction)) * DEPTH_PACK_FAR;
  if (depth >= DEPTH_PACK_FAR - DEPTH_TOLERANCE) return 1.0;
  return step(compare, depth);
}

#if (__VERSION__ < 300)
  // Non optimised:
  float PCFCube(samplerCube depths, vec2 size, vec3 direction, float compare) {
    float result = 0.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 off = vec3(x, y, z) / float(size);
          result += textureCubeCompare(depths, direction + off, compare);
        }
      }
    }
    return result /= 27.0;
  }
#else
  // https://learnopengl.com/Advanced-Lighting/Shadows/Point-Shadows
  vec3 sampleOffsetDirections[20] = vec3[](
    vec3( 1,  1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1,  1,  1),
    vec3( 1,  1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1,  1, -1),
    vec3( 1,  1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1,  1,  0),
    vec3( 1,  0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1,  0, -1),
    vec3( 0,  1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0,  1, -1)
  );

  float PCFCube(samplerCube depths, vec2 size, vec3 direction, float compare) {
    float result = 0.0;

    for (int i = 0; i < 20; i++) {
      result += textureCubeCompare(depths, direction + sampleOffsetDirections[i] / float(size), compare);
    }

    return result /= 20.0;
  }
#endif
`;

var pcf_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  PCF: PCF,
  PCFCube: PCFCube
});

// Percentage-Closer Soft Shadows (PCSS)
// Papers:
// - https://developer.download.nvidia.com/shaderlibrary/docs/shadow_PCSS.pdf
// - https://wojtsterna.files.wordpress.com/2023/02/contact_hardening_soft_shadows.pdf
// - https://www.gamedevs.org/uploads/advanced-soft-shadow-mapping-techniques.pdf
// Reference Implementations:
// - https://developer.download.nvidia.com/whitepapers/2008/PCSS_Integration.pdf
// - https://developer.download.nvidia.com/SDK/10.5/Samples/PercentageCloserSoftShadows.zip
// using vogelDisk: https://drdesten.github.io/web/tools/vogel_disk/?sample_input=64
// instead of:
// const vec2 poissonDisk[64] = vec2[](
//   vec2(-0.934812, 0.366741), vec2(-0.918943, -0.0941496), vec2(-0.873226, 0.62389), vec2(-0.8352, 0.937803), vec2(-0.822138, -0.281655), vec2(-0.812983, 0.10416), vec2(-0.786126, -0.767632), vec2(-0.739494, -0.535813), vec2(-0.681692, 0.284707), vec2(-0.61742, -0.234535), vec2(-0.601184, 0.562426), vec2(-0.607105, 0.847591), vec2(-0.581835, -0.00485244), vec2(-0.554247, -0.771111), vec2(-0.483383, -0.976928), vec2(-0.476669, -0.395672), vec2(-0.439802, 0.362407), vec2(-0.409772, -0.175695), vec2(-0.367534, 0.102451), vec2(-0.35313, 0.58153), vec2(-0.341594, -0.737541), vec2(-0.275979, 0.981567), vec2(-0.230811, 0.305094), vec2(-0.221656, 0.751152), vec2(-0.214393, -0.0592364), vec2(-0.204932, -0.483566), vec2(-0.183569, -0.266274), vec2(-0.123936, -0.754448), vec2(-0.0859096, 0.118625), vec2(-0.0610675, 0.460555), vec2(-0.0234687, -0.962523), vec2(-0.00485244, -0.373394), vec2(0.0213324, 0.760247), vec2(0.0359813, -0.0834071), vec2(0.0877407, -0.730766), vec2(0.14597, 0.281045), vec2(0.18186, -0.529649), vec2(0.188208, -0.289529), vec2(0.212928, 0.063509), vec2(0.23661, 0.566027), vec2(0.266579, 0.867061), vec2(0.320597, -0.883358), vec2(0.353557, 0.322733), vec2(0.404157, -0.651479), vec2(0.410443, -0.413068), vec2(0.413556, 0.123325), vec2(0.46556, -0.176183), vec2(0.49266, 0.55388), vec2(0.506333, 0.876888), vec2(0.535875, -0.885556), vec2(0.615894, 0.0703452), vec2(0.637135, -0.637623), vec2(0.677236, -0.174291), vec2(0.67626, 0.7116), vec2(0.686331, -0.389935), vec2(0.691031, 0.330729), vec2(0.715629, 0.999939), vec2(0.8493, -0.0485549), vec2(0.863582, -0.85229), vec2(0.890622, 0.850581), vec2(0.898068, 0.633778), vec2(0.92053, -0.355693), vec2(0.933348, -0.62981), vec2(0.95294, 0.156896)
// );
const PCSSCommon = /* glsl */ `
#ifndef PCSS_BLOCKER_SEARCH_NUM_SAMPLES
  #define PCSS_BLOCKER_SEARCH_NUM_SAMPLES 25
#endif
#ifndef PCSS_PCF_NUM_SAMPLES
  #define PCSS_PCF_NUM_SAMPLES 64
#endif

float interleavedGradientNoise(vec2 fragCoord) {
  const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(fragCoord, magic.xy)));
}

mat2 getRandomRotationMatrix(highp vec2 fragCoord) {
  // float r = rand(fragCoord) * TWO_PI;
  float randomAngle = interleavedGradientNoise(fragCoord) * TWO_PI;
  vec2 randomBase = vec2(cos(randomAngle), sin(randomAngle));
  return mat2(randomBase.x, randomBase.y, -randomBase.y, randomBase.x);
}

#if (__VERSION__ < 300)
  const float GOLDEN_ANGLE = PI * (3.0 - sqrt(5.0));
  vec2 vogelDiskSample(float n, float count) {
    float theta = n * GOLDEN_ANGLE;
    float radius = (1.0 / sqrt(count)) * sqrt(n);
    return vec2(radius * cos(theta), radius * sin(theta));
  }
#else
  const vec2 vogelDisk[64] = vec2[](vec2(0.07966914016126773, -0.0005732549414365655),vec2(-0.12160530145582471, 0.10283965425501301),vec2(0.008559818525228833, -0.197458844206032),vec2(0.13356640242431705, 0.18501312713480866),vec2(-0.269830801109193, -0.04676021929400281),vec2(0.23862848827685754, -0.15791561224005177),vec2(-0.09145217101863704, 0.3071892456093635),vec2(-0.16649994145461533, -0.30437045701653237),vec2(0.33360187330480306, 0.12444185472734362),vec2(-0.3648472506019276, 0.14643122426640393),vec2(0.16295804188571, -0.36743756507231173),vec2(0.11814591296857804, 0.40389274018272564),vec2(-0.39109215347150406, -0.22216619295880746),vec2(0.43984778429926974, -0.0991894497563406),vec2(-0.2824726599141313, 0.38881286099524415),vec2(-0.07196259394779835, -0.48861810336110434),vec2(0.3795331553348995, 0.3266462474773111),vec2(-0.5311851850227693, 0.021032353535204915),vec2(0.3723796163057802, -0.3798174856209827),vec2(-0.03421619527550065, 0.5508226133906681),vec2(-0.37133596181036055, -0.43510931729303065),vec2(0.5657057697780938, 0.07671481330934922),vec2(-0.49542832895271105, 0.3380662747684381),vec2(0.12427771910967947, -0.5917579278786026),vec2(0.2988957646566429, 0.536255888187953),vec2(-0.6100770454895419, -0.19242280712483223),vec2(0.5754234023037136, -0.27046195686657265),vec2(-0.2617843818309086, 0.6041130418557645),vec2(-0.2345742995202231, -0.6285079469299325),vec2(0.59225695199046, 0.315282971433257),vec2(-0.6762525075113398, 0.17538638065344198),vec2(0.37071132728294354, -0.5906749150680255),vec2(0.1119798859418661, 0.7017402283731283),vec2(-0.5807270152810202, -0.4435682524557845),vec2(0.7229827225912143, -0.06119326417718071),vec2(-0.5144794788954391, 0.5461387788248903),vec2(-0.005035179534685496, -0.7557546423829214),vec2(0.5055857377426614, 0.5663728829872585),vec2(-0.7810140733390272, -0.07214936952359105),vec2(0.6170681003447506, -0.47552351060683423),vec2(-0.15109977600025168, 0.7820762666899624),vec2(-0.43760314844428994, -0.6821127366950525),vec2(0.7772009255491943, 0.21481487028437787),vec2(-0.742204728724318, 0.3758394044302885),vec2(0.28114246867378123, -0.7824253564882913),vec2(0.3091922614465049, 0.7803683548608),vec2(-0.7789831306606205, -0.36561570268862775),vec2(0.8145440939773348, -0.2543941296975529),vec2(-0.4488757377357506, 0.7504758305912105),vec2(-0.1933624476019976, -0.8604246222601459),vec2(0.7154581485450054, 0.513848417434855),vec2(-0.8988765686147268, 0.11036534262592021),vec2(0.5783350546530844, -0.6902686901177914),vec2(0.024600692161986272, 0.9131155784626814),vec2(-0.6564461645240189, -0.657849672537283),vec2(0.9212949234450745, 0.04697899281368057),vec2(-0.7330423210662792, 0.5978985715758123),vec2(0.12225611512756368, -0.9393399804201348),vec2(0.5334856827883492, 0.7868760176859763),vec2(-0.948368229388031, -0.21678429915641398),vec2(0.8372175428305082, -0.4798472000523386),vec2(-0.31121110469716806, 0.9318623471900049),vec2(-0.41881630178513873, -0.899674402337137),vec2(0.9082566602526256, 0.38845471061254216));
#endif
`;
const PCSS = /* glsl */ `
// Using similar triangles from the surface point to the area light
vec2 SearchRegionRadiusUV(float zWorld, float near, vec2 radiusUV) {
  return radiusUV * (zWorld - near) / zWorld;
}

// Shadow Mapping: GPU-based Tips and Techniques
// https://gdcvault.com/play/1013442/Shadow-Mapping-Tricks-and (p41)
// Derivatives of light-space depth with respect to texture coordinates
vec2 DepthGradient(vec3 position) {
  vec3 duvdist_dx = dFdx(position);
  vec3 duvdist_dy = dFdy(position);

  return vec2(
    duvdist_dy.y * duvdist_dx.z - duvdist_dx.y * duvdist_dy.z,
    duvdist_dx.x * duvdist_dy.z - duvdist_dy.x * duvdist_dx.z
  ) / ((duvdist_dx.x * duvdist_dy.y) - (duvdist_dx.y * duvdist_dy.x));
}

float BiasedZ(float z0, vec2 dz_duv, vec2 offset) {
  return z0 + dot(dz_duv, offset);
}

void PCSSFindBlocker(
  sampler2D depths,
  vec2 uv,
  float compare,
  float near,
  float far,
  vec2 searchWidth,
  vec2 dz_duv,
  mat2 R,
  out float blockerSum,
  out float numBlockers
) {
  for (int i = 0; i < PCSS_BLOCKER_SEARCH_NUM_SAMPLES; i++) {
    #if (__VERSION__ < 300)
      vec2 r = vogelDiskSample(float(i), float(PCSS_BLOCKER_SEARCH_NUM_SAMPLES));
    #else
      vec2 r = vogelDisk[i];
    #endif
    highp vec2 offset = R * (r * searchWidth);

    float depth = texture2D(depths, uv + offset).r;
    float z = BiasedZ(compare, dz_duv, offset);

    if (depth < z) {
      blockerSum += depth;
      numBlockers += 1.0;
    }
  }
}

float PCSSPCFFilter(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far, vec2 dz_duv, mat2 R, vec2 filterRadiusUV) {
  float result = 0.0;

  for (int i = 0; i < PCSS_PCF_NUM_SAMPLES; ++i) {
    #if (__VERSION__ < 300)
      vec2 r = vogelDiskSample(float(i), float(PCSS_PCF_NUM_SAMPLES));
    #else
      vec2 r = vogelDisk[i];
    #endif
    highp vec2 offset = R * (r * filterRadiusUV);

    float z = BiasedZ(compare, dz_duv, offset);

    result += texture2DCompare(depths, uv + offset, z, near, far);
  }
  return result / float(PCSS_PCF_NUM_SAMPLES);
}

float PCSS(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far, float ndcLightZ, vec2 radiusUV) {
  vec2 shadowMapSizeInverse = 1.0 / size;
  mat2 R = getRandomRotationMatrix(gl_FragCoord.xy);
  vec2 dz_duv = DepthGradient(vec3(uv.xy, ndcLightZ));

  // STEP 1: blocker search
  float avgBlockerDepth = 0.0;
  float numBlockers = 0.0;
  vec2 searchRegionRadiusUV = SearchRegionRadiusUV(compare, near, radiusUV) * shadowMapSizeInverse;
  PCSSFindBlocker(
    depths,
    uv,
    compare,
    near,
    far,
    searchRegionRadiusUV,
    dz_duv,
    R,
    avgBlockerDepth,
    numBlockers
  );

  // There are no occluders so early out (this saves filtering and avoid division by 0)
  if (numBlockers == 0.0) return 1.0;

  // Actually perform the average
  avgBlockerDepth /= numBlockers;

  // STEP 2: penumbra size
  // Offset preventing aliasing on contact.
  vec2 AAOffset = shadowMapSizeInverse * 10.0;
  // TODO: should it be adjusted for spotlights?
  vec2 penumbraRatio = ((compare - avgBlockerDepth) + AAOffset);
  vec2 filterRadiusUV = penumbraRatio * radiusUV * shadowMapSizeInverse;

  // STEP 3: filtering
  return PCSSPCFFilter(depths, size, uv, compare, near, far, dz_duv, R, filterRadiusUV);
}
`;
const PCSSCube = /* glsl */ `
void PCSSFindBlockerCube(
  samplerCube depths,
  vec3 direction,
  float compare,
  float searchWidth,
  mat2 R,
  out float blockerSum,
  out float numBlockers
) {
  for (int i = 0; i < PCSS_BLOCKER_SEARCH_NUM_SAMPLES; i++) {
    #if (__VERSION__ < 300)
      vec2 r = vogelDiskSample(float(i), float(PCSS_BLOCKER_SEARCH_NUM_SAMPLES));
    #else
      vec2 r = R * vogelDisk[i];
    #endif
    highp vec3 offset = vec3(r.x, float(i / PCSS_BLOCKER_SEARCH_NUM_SAMPLES), r.y) * searchWidth;

    float depth = textureCube(depths, normalize(direction + offset)).r;
    // float depth = unpackDepth(textureCube(depths, normalize(direction + offset))) * DEPTH_PACK_FAR;

    if (depth < compare) {
      blockerSum += depth;
      numBlockers += 1.0;
    }
  }
}

float PCSSPCFFilterCube(samplerCube depths, vec2 size, vec3 direction, float compare, mat2 R, float filterRadius) {
  float result = 0.0;

  for (int i = 0; i < PCSS_PCF_NUM_SAMPLES; ++i) {
    #if (__VERSION__ < 300)
      vec2 r = vogelDiskSample(float(i), float(PCSS_PCF_NUM_SAMPLES));
    #else
      vec2 r = R * vogelDisk[i];
    #endif
    highp vec3 offset = vec3(r.x, float(i / PCSS_PCF_NUM_SAMPLES), r.y) * filterRadius;

    result += textureCubeCompare(depths, normalize(direction + offset), compare);
    // result += PCFCube(depths, size, normalize(direction + offset), compare);
  }
  return result / float(PCSS_PCF_NUM_SAMPLES);
}

float PCSSCube(samplerCube depths, vec2 size, vec3 direction, float compare, float radius) {
  float shadowMapSizeInverse = (1.0 / size.x);
  mat2 R = getRandomRotationMatrix(gl_FragCoord.xy);

  float avgBlockerDepth = 0.0;
  float numBlockers = 0.0;
  float searchRegionRadius = radius * shadowMapSizeInverse;
  PCSSFindBlockerCube(
    depths,
    direction,
    compare,
    searchRegionRadius,
    R,
    avgBlockerDepth,
    numBlockers
  );

  if (numBlockers == 0.0) return 1.0;

  avgBlockerDepth /= numBlockers;

  float AAOffset = shadowMapSizeInverse * 10.0;
  float penumbraRatio = ((compare - avgBlockerDepth) + AAOffset);
  float filterRadius = penumbraRatio * radius * shadowMapSizeInverse;

  return PCSSPCFFilterCube(depths, size, direction, compare, R, filterRadius);
}
`;

var pcss_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  PCSS: PCSS,
  PCSSCommon: PCSSCommon,
  PCSSCube: PCSSCube
});

var shadowing_glsl = /* glsl */ `
#if NUM_DIRECTIONAL_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 || NUM_AREA_LIGHTS > 0 || NUM_POINT_LIGHTS > 0
  const float DEPTH_TOLERANCE = 0.001;
  ${PCSSCommon}
#endif

#if NUM_DIRECTIONAL_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 || NUM_AREA_LIGHTS > 0
  ${PCF}
  ${PCSS}

  float getShadow(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far, float ndcLightZ, vec2 radiusUV) {
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
      return 1.0;
    }
    #if SHADOW_QUALITY == 0
      return 1.0;
    #endif
    #if SHADOW_QUALITY == 1
      return texture2DCompare(depths, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 2
      return texture2DShadowLerp(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 3
      return PCF3x3(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 4
      return PCF5x5(depths, size, uv, compare, near, far);
    #endif
    #if SHADOW_QUALITY == 5
      return PCSS(depths, size, uv, compare, near, far, ndcLightZ, radiusUV);
    #endif
  }
#endif

#if NUM_POINT_LIGHTS > 0
  ${PCFCube}
  ${PCSSCube}

  float getPunctualShadow(samplerCube depths, vec2 size, vec3 direction, float compare, float radius) {
    #if SHADOW_QUALITY == 0
      return 1.0;
    #endif
    #if SHADOW_QUALITY == 1 || SHADOW_QUALITY == 2
      return textureCubeCompare(depths, direction, compare);
    #endif
    #if SHADOW_QUALITY == 3 || SHADOW_QUALITY == 4
      return PCFCube(depths, size, direction, compare);
    #endif
    #if SHADOW_QUALITY == 5
      return PCSSCube(depths, size, direction, compare, radius);
    #endif
  }
#endif
`;

// Distribution:
// https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf
// Walter et al. 2007, "Microfacet Models for Refraction through Rough Surfaces"
// Used by: clearCoat
const D_GGX = /* glsl */ `
float D_GGX(float linearRoughness, float NoH) {
  float oneMinusNoHSquared = 1.0 - NoH * NoH;
  float a = NoH * linearRoughness;
  float k = linearRoughness / (oneMinusNoHSquared + a * a);
  float d = k * k * (1.0 / PI);
  return saturateMediump(d);
}
`;
// TODO: use optimised version
// The following equation(s) model the distribution of microfacet normals across the area being drawn (aka D())
// Implementation from "Average Irregularity Representation of a Roughened Surface for Ray Reflection" by T. S. Trowbridge, and K. P. Reitz
// Follows the distribution function recommended in the SIGGRAPH 2013 course notes from EPIC Games [1], Equation 3.
// float D_GGX(float NdotH, float alphaRoughness) {
//   float alphaRoughnessSq = alphaRoughness * alphaRoughness;
//   float f = (NdotH * NdotH) * (alphaRoughnessSq - 1.0) + 1.0;
//   return alphaRoughnessSq / (PI * f * f);
// }
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF"
// https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf
// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_sheen/README.md#sheen-distribution
// Used by: sheen
const D_Charlie = /* glsl */ `
float D_Charlie(float linearRoughness, float NoH) {
  float invAlpha  = 1.0 / linearRoughness;
  float cos2h = NoH * NoH;
  // float sin2h = max(1.0 - cos2h, 0.0078125); // 2^(-14/2), so sin2h^2 > 0 in fp16
  float sin2h = 1.0 - cos2h;
  return (2.0 + invAlpha) * pow(sin2h, invAlpha * 0.5) / (2.0 * PI);
}
`;
// Visibility:
// Kelemen 2001, "A Microfacet Based Coupled Specular-Matte BRDF Model with Importance Sampling"
// Used by: clearCoat
const V_Kelemen = /* glsl */ `
float V_Kelemen(float LoH) {
  return saturateMediump(0.25 / (LoH * LoH));
}
`;
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF"
// https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf
// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_sheen/README.md#sheen-distribution
// Used by: sheen
const V_Charlie = /* glsl */ `
float Sheen_l(float x, float alphaG) {
  float oneMinusAlphaSq = (1.0 - alphaG) * (1.0 - alphaG);
  float a = mix(21.5473, 25.3245, oneMinusAlphaSq);
  float b = mix(3.82987, 3.32435, oneMinusAlphaSq);
  float c = mix(0.19823, 0.16801, oneMinusAlphaSq);
  float d = mix(-1.97760, -1.27393, oneMinusAlphaSq);
  float e = mix(-4.32054, -4.85967, oneMinusAlphaSq);
  return a / (1.0 + b * pow(x, c)) + d * x + e;
}
float lambdaSheen(float cosTheta, float alphaG) {
  return abs(cosTheta) < 0.5 ? exp(Sheen_l(cosTheta, alphaG)) : exp(2.0 * Sheen_l(0.5, alphaG) - Sheen_l(1.0 - cosTheta, alphaG));
}
float V_Charlie(float linearRoughness, float NdotV, float NdotL, float NdotH) {
  return 1.0 / ((1.0 + lambdaSheen(NdotV, linearRoughness) + lambdaSheen(NdotL, linearRoughness)) * (4.0 * NdotV * NdotL));
}
`;
// Alternative to V_Charlie (but non energy conserving for albedo scaling):
// float V_Neubelt(float NdotV, float NdotL, float NdotH) {
//   return 1.0 / (4.0 * (NdotL + NdotV - NdotL * NdotV));
// }
// Fresnel:
// Assumes an air-polyurethane interface with a fixed IOR of 1.5 (4% reflectance, IOR = 1.5 -> F0 = 0.04).
// Used by: clearCoat
const F_SchlickClearCoat = /* glsl */ `
float F_SchlickClearCoat(float VoH) {
  return 0.04 + 0.96 * pow(1.0 - VoH, 5.0);
}
`;
// Diffuse:
const DiffuseLambert = /* glsl */ `
float DiffuseLambert() {
  return 1.0 / PI;
}
`;
// Base layer:
// GGX, Trowbridge-Reitz
// Same as glTF2.0 PBR Spec
const MicrofacetDistribution = /* glsl */ `
float MicrofacetDistribution(float linearRoughness, float NdotH) {
  float a2 = linearRoughness * linearRoughness;
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  if (denom > 0.0) {
    return nom / denom;
  } else {
    return 1.0;
  }
}
`;
// FresnelSchlick
// Same as glTF2.0 PBR Spec
const SpecularReflection = /* glsl */ `
vec3 SpecularReflection(vec3 specularColor, float HdotV) {
  float cosTheta = HdotV;
  return specularColor + (1.0 - specularColor) * pow(1.0 - cosTheta, 5.0);
}
`;
// TODO: use optimised version
// Scalar optimization of the specular F term
// https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/fresnel(specularf)
// vec3 F_Schlick(const vec3 f0, float VoH) {
//   float f = pow(1.0 - VoH, 5.0);
//   return f + f0 * (1.0 - f);
// }
// Smith Joint GGX
// Sometimes called Smith GGX Correlated
// Note: Vis = G / (4 * NdotL * NdotV)
// see Eric Heitz. 2014. Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs. Journal of Computer Graphics Techniques, 3
// see Real-Time Rendering. Page 331 to 336.
// see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg)
const VisibilityOcclusion = /* glsl */ `
float VisibilityOcclusion(float linearRoughness, float NdotL, float NdotV) {
  float linearRoughnessSq = linearRoughness * linearRoughness;

  float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - linearRoughnessSq) + linearRoughnessSq);
  float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - linearRoughnessSq) + linearRoughnessSq);

  float GGX = GGXV + GGXL;
  if (GGX > 0.0) {
      return 0.5 / GGX;
  }
  return 0.0;
}
`;
var brdf_glsl = /* glsl */ `
${D_GGX}
${D_Charlie}
${V_Kelemen}
${V_Charlie}
${F_SchlickClearCoat}

${DiffuseLambert}
${MicrofacetDistribution}
${SpecularReflection}
${VisibilityOcclusion}
`;

// getDistanceAttenuation: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
// sheenBRDF: The Fresnel term may be omitted, i.e., F = 1.
var direct_glsl = /* glsl */ `
struct Light {
  vec3 l;
  vec4 color;
  float attenuation;
};

float getDistanceAttenuation(const highp vec3 posToLight, float falloff) {
  // Square Falloff Attenuation
  float distanceSquare = dot(posToLight, posToLight);
  float factor = distanceSquare * falloff;
  float smoothFactor = saturate(1.0 - factor * factor);
  float attenuation = smoothFactor * smoothFactor;

  return attenuation * 1.0 / max(distanceSquare, 1e-4);
}

float getAngleAttenuation(const vec3 lightDir, const vec3 l, const vec2 scaleOffset) {
  float cd = dot(lightDir, l);
  float attenuation  = saturate(cd * scaleOffset.x + scaleOffset.y);
  return attenuation * attenuation;
}

#ifdef USE_SHEEN
  vec3 sheenBRDF(const PBRData data, float NdotH, float NdotV, float NdotL) {
    float sheenDistribution = D_Charlie(data.sheenLinearRoughness, NdotH);
    float sheenVisibility = V_Charlie(data.sheenLinearRoughness, NdotV, NdotL, NdotH);
    return data.sheenColor * sheenDistribution * sheenVisibility;
  }
#endif

#ifdef USE_CLEAR_COAT
  float clearCoatBRDF(const PBRData data, const vec3 h, float NoH, float LoH, out float Fcc) {
    #if defined(USE_NORMAL_TEXTURE) || defined(USE_CLEAR_COAT_NORMAL_TEXTURE)
      float clearCoatNoH = saturate(dot(data.clearCoatNormal, h));
    #else
      float clearCoatNoH = NoH;
    #endif
    float D = D_GGX(data.clearCoatLinearRoughness, clearCoatNoH);
    float V = V_Kelemen(LoH);
    float F = F_SchlickClearCoat(LoH) * data.clearCoat;

    Fcc = F;
    return D * V * F;
  }
#endif

void getSurfaceShading(inout PBRData data, Light light, float illuminated) {
  vec3 N = data.normalWorld;
  vec3 V = data.viewWorld;
  vec3 L = normalize(light.l);
  vec3 H = normalize(V + L);

  float NdotV = saturate(abs(dot(N, V)) + FLT_EPS);
  float NdotL = saturate(dot(N, L));

  if (NdotL <= 0.0 || NdotV <= 0.0) return;

  float NdotH = saturate(dot(N, H));
  float LdotH = saturate(dot(L, H));
  float HdotV = max(0.0, dot(H, V));

  // vec3 F = F_Schlick(data.f0, LdotH);
  vec3 F = SpecularReflection(data.f0, HdotV);
  float D = MicrofacetDistribution(data.linearRoughness, NdotH);
  float Vis = VisibilityOcclusion(data.linearRoughness, NdotL, NdotV);

  //TODO: switch to linear colors
  vec3 lightColor = decode(light.color, SRGB).rgb;

  vec3 Fd = DiffuseLambert() * data.diffuseColor;
  vec3 Fr = F * Vis * D;

  //TODO: energy compensation
  float energyCompensation = 1.0;

  #ifdef USE_DIFFUSE_TRANSMISSION
    vec3 diffuse_btdf = light.attenuation * saturate(dot(-N, L)) * (DiffuseLambert() * data.diffuseTransmissionColor);

    #ifdef USE_VOLUME
      diffuse_btdf = applyVolumeAttenuation(diffuse_btdf, data.diffuseTransmissionThickness, data.attenuationColor, data.attenuationDistance);
    #endif
    Fd = mix(Fd, diffuse_btdf, data.diffuseTransmission);
  #endif

  #ifdef USE_TRANSMISSION
    Fd *= (1.0 - data.transmission);
  #endif

  vec3 color = Fd + Fr * energyCompensation;

  #ifdef USE_SHEEN
    color *= data.sheenAlbedoScaling;
    color += sheenBRDF(data, NdotH, NdotV, NdotL);
  #endif

  #ifdef USE_CLEAR_COAT
    float Fcc;
    float clearCoat = clearCoatBRDF(data, H, NdotH, LdotH, Fcc);
    float attenuation = 1.0 - Fcc;

    color *= attenuation * NdotL;

    // direct light still uses NdotL but clear coat needs separate dot product when using normal map
    // if only normal map is present not clear coat normal map, we will get smooth coating on top of bumpy surface
    #if defined(USE_NORMAL_TEXTURE) || defined(USE_CLEAR_COAT_NORMAL_TEXTURE)
      float clearCoatNoL = saturate(dot(data.clearCoatNormal, light.l));
      color += clearCoat * clearCoatNoL;
    #else
      color += clearCoat * NdotL;
    #endif
  #else
    color *= NdotL;
  #endif

  data.directColor += (color * lightColor) * (light.color.a * light.attenuation * illuminated);
}
`;

var indirect_glsl = /* glsl */ `
#ifdef USE_REFLECTION_PROBES
  uniform sampler2D uReflectionMap;
  uniform float uReflectionMapSize;

  #define MAX_MIPMAP_LEVEL 5.0

  vec3 getPrefilteredReflection(vec3 reflected, float roughness) {
    float lod = pow(roughness, 2.0) * MAX_MIPMAP_LEVEL; // TODO: verify reflection probe blurring code
    // float lod = pow(roughness, 1.5) * MAX_MIPMAP_LEVEL;
    float upLod = floor(lod);
    float downLod = ceil(lod);

    vec3 a = texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, upLod, uReflectionMapSize)).rgb;
    vec3 b = texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, downLod, uReflectionMapSize)).rgb;

    return mix(a, b, lod - upLod);
  }

  // https://www.unrealengine.com/en-US/blog/physically-based-shading-on-mobile
  vec3 EnvBRDFApprox( vec3 specularColor, vec3 specularF90, float roughness, float NoV ) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022 );
    const vec4 c1 = vec4( 1.0, 0.0425, 1.04, -0.04 );
    vec4 r = roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
    vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
    return specularColor * AB.x + specularF90 * AB.y;
  }

  #ifdef USE_CLEAR_COAT
    // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/clearcoat
    void evaluateClearCoatIBL(const PBRData data, float ao, inout vec3 Fd, inout vec3 Fr) {
      #if defined(USE_NORMAL_TEXTURE) || defined(USE_CLEAR_COAT_NORMAL_TEXTURE)
        float clearCoatNoV = abs(dot(data.clearCoatNormal, data.viewWorld)) + FLT_EPS;
        vec3 clearCoatR = reflect(-data.viewWorld, data.clearCoatNormal);
      #else
        float clearCoatNoV = data.NdotV;
        vec3 clearCoatR = data.reflectionWorld;
      #endif
      // The clear coat layer assumes an IOR of 1.5 (4% reflectance)
      float Fc = F_SchlickClearCoat(clearCoatNoV) * data.clearCoat;
      float attenuation = 1.0 - Fc;
      // https://github.com/google/filament/commit/6a8e6d45b5c57280898ad064426bc197978e71c5
      // Fr *= (attenuation * attenuation);
      Fr *= attenuation;
      Fr += getPrefilteredReflection(clearCoatR, data.clearCoatRoughness) * (ao * Fc);
      Fd *= attenuation;
    }
  #endif

  #ifdef USE_SHEEN
    // = sheen DFG
    // // https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
    float IBLSheenBRDF(float roughness, float linearRoughness, float NdotV) {
      float a = roughness < 0.25 ? -339.2 * linearRoughness + 161.4 * roughness - 25.9 : -8.48 * linearRoughness + 14.3 * roughness - 9.95;
      float b = roughness < 0.25 ? 44.0 * linearRoughness - 23.7 * roughness + 3.26 : 1.97 * linearRoughness - 3.27 * roughness + 0.72;
      float DG = exp(a * NdotV + b) + (roughness < 0.25 ? 0.0 : 0.1 * (roughness - 0.25));
      return saturate(DG * (1.0 / PI));
    }

    // https://github.com/google/filament/blob/21ea99a1d934e37d876f15bed5b025ed181bc08f/shaders/src/light_indirect.fs#L394
    void evaluateSheenIBL(inout PBRData data, float ao, inout vec3 Fd, inout vec3 Fr) {
      // Albedo scaling of the base layer before we layer sheen on top
      Fd *= data.sheenAlbedoScaling;
      Fr *= data.sheenAlbedoScaling;

      vec3 reflectance = data.sheenColor * IBLSheenBRDF(data.sheenRoughness, data.sheenLinearRoughness, data.NdotV);
      reflectance *= ao;
      Fr += reflectance * getPrefilteredReflection(data.reflectionWorld, data.sheenRoughness);
    }
  #endif

  #ifdef USE_TRANSMISSION
    // https://github.com/KhronosGroup/glTF-Sample-Viewer/blob/6bc1df9c334288fb0d91d2febfddf97ac5dfd045/source/Renderer/shaders/ibl.glsl#L78
    vec3 getTransmissionSample(vec2 fragCoord, float roughness, float ior) {
      float framebufferLod = log2(float(uViewportSize.x)) * applyIorToRoughness(roughness, ior);
      return textureBicubic(uCaptureTexture, fragCoord.xy, framebufferLod).rgb;
    }

    vec3 getIBLVolumeRefraction(inout PBRData data, vec3 Fr) {
      #ifdef USE_DISPERSION
        // Dispersion will spread out the ior values for each r,g,b channel
        float halfSpread = (data.ior - 1.0) * 0.025 * data.dispersion;
        vec3 iors = vec3(data.ior - halfSpread, data.ior, data.ior + halfSpread);

        vec3 transmittedLight;
        float transmissionRayLength;

        for (int i = 0; i < 3; i++) {
          vec3 transmissionRay = getVolumeTransmissionRay(data.normalWorld, data.viewWorld, data.thickness, iors[i], uModelMatrix);
          // TODO: taking length of blue ray, ideally we would take the length of the green ray. For now overwriting seems ok
          transmissionRayLength = length(transmissionRay);
          vec3 refractedRayExit = data.positionWorld + transmissionRay;

          // Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
          vec4 ndcPos = uProjectionMatrix * uViewMatrix * vec4(refractedRayExit, 1.0);
          vec2 refractionCoords = ndcPos.xy / ndcPos.w;
          refractionCoords += 1.0;
          refractionCoords /= 2.0;

          // Sample framebuffer to get pixel the refracted ray hits for this color channel.
          transmittedLight[i] = getTransmissionSample(refractionCoords, data.roughness, iors[i])[i];
        }
      #else
        vec3 transmissionRay = getVolumeTransmissionRay(data.normalWorld, data.viewWorld, data.thickness, data.ior, uModelMatrix);
        float transmissionRayLength = length(transmissionRay);
        vec3 refractedRayExit = data.positionWorld + transmissionRay;

        // Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
        vec4 ndcPos = uProjectionMatrix * uViewMatrix * vec4(refractedRayExit, 1.0);
        vec2 refractionCoords = ndcPos.xy / ndcPos.w;
        refractionCoords += 1.0;
        refractionCoords /= 2.0;

        // Sample framebuffer to get pixel the refracted ray hits.
        vec3 transmittedLight = getTransmissionSample(refractionCoords, data.roughness, data.ior);
      #endif

      vec3 attenuatedColor = applyVolumeAttenuation(transmittedLight.rgb, transmissionRayLength, data.attenuationColor, data.attenuationDistance);

      // TODO: double check that's correct
      vec3 specularColor = Fr;

      return (1.0 - specularColor) * attenuatedColor * data.diffuseColor;
    }
  #endif

  void EvaluateLightProbe(inout PBRData data, float ao) {
    // TODO: energyCompensation
    float energyCompensation = 1.0;

    // diffuse layer
    vec3 diffuseIrradiance = getIrradiance(data.normalWorld, uReflectionMap, uReflectionMapSize, LINEAR);
    vec3 Fd = data.diffuseColor * diffuseIrradiance * ao;

    #ifdef USE_DIFFUSE_TRANSMISSION
      vec3 diffuseTransmissionIBL = getIrradiance(-data.normalWorld, uReflectionMap, uReflectionMapSize, LINEAR) * data.diffuseTransmissionColor;
      #ifdef USE_VOLUME
        diffuseTransmissionIBL = applyVolumeAttenuation(diffuseTransmissionIBL, data.diffuseTransmissionThickness, data.attenuationColor, data.attenuationDistance);
      #endif
      Fd = mix(Fd, diffuseTransmissionIBL, data.diffuseTransmission);
    #endif

    vec3 specularReflectance = EnvBRDFApprox(data.f0, data.f90, data.roughness, data.NdotV);
    vec3 prefilteredRadiance = getPrefilteredReflection(data.reflectionWorld, data.roughness);

    vec3 Fr = specularReflectance * prefilteredRadiance * ao;
    Fr *= energyCompensation;

    // extra ambient occlusion term for the base and subsurface layers
    multiBounceAO(ao, data.diffuseColor, Fd);
    // multiBounceSpecularAO(specularAO, data.f0, Fr);

    #ifdef USE_SHEEN
      evaluateSheenIBL(data, ao, Fd, Fr);
    #endif

    #ifdef USE_CLEAR_COAT
      evaluateClearCoatIBL(data, ao, Fd, Fr);
    #endif

    #ifdef USE_TRANSMISSION
      vec3 Ft = getIBLVolumeRefraction(data, Fr);
      Ft *= data.transmission;
      Fd *= (1.0 - data.transmission);
      data.transmitted += Ft;
    #endif

    data.indirectDiffuse += Fd;
    data.indirectSpecular += Fr;
  }
#endif
`;

// Based on http://http.developer.nvidia.com/GPUGems/gpugems_ch17.html and http://gl.ict.usc.edu/Data/HighResProbes/
// flipEnvMap:
// - -1.0 for left handed coorinate system oriented texture (usual case)
// - 1.0 for right handed coorinate system oriented texture
//
// I assume envMap texture has been flipped the WebGL way (pixel 0,0 is a the bottom)
// therefore we flip wcNorma.y as acos(1) = 0
var envMapEquirect_glsl = /* glsl */ `
vec2 envMapEquirect(vec3 wcNormal) {
  float flipEnvMap = -1.0;
  float phi = acos(-wcNormal.y);
  float theta = atan(wcNormal.x, flipEnvMap * wcNormal.z) + PI;
  return vec2(theta / TWO_PI, phi / PI);
}
`;

var octMap_glsl = /* glsl */ `
vec2 envMapOctahedral(vec3 dir) {
  dir /= dot(vec3(1.0), abs(dir));
  // Add epsylon to avoid bottom face flickering when sampling irradiance
  dir += 0.00001;
  if (dir.y < 0.0) {
    dir.xy = vec2(1.0 - abs(dir.zx)) * sign(dir.xz);
  }
  else {
    dir.xy = dir.xz;
  }
  dir.xy = dir.xy * 0.5;
  dir.xy += 0.5; // move to center
  // dir.xy = (dir.xy * 64.0 + 1.0) / 66.0;
  return dir.xy;
}

vec2 envMapOctahedral(vec3 dir, float textureSize) {
  dir /= dot(vec3(1.0), abs(dir));
  if (dir.y < 0.0) {
    dir.xy = vec2(1.0 - abs(dir.zx)) * sign(dir.xz);
  }
  else {
    dir.xy = dir.xz;
  }
  dir.xy = dir.xy * 0.5;
  dir.xy += 0.5; // move to center

  // center on texels
  dir.xy += 0.5 / textureSize;
  dir.xy /= textureSize / (textureSize - 1.0);

  return dir.xy;
}

vec2 envMapOctahedral(vec3 dir, float mipmapLevel, float roughnessLevel, float octMapAtlasSize) {
  float width = octMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size
  float levelSizeInPixels = pow(2.0, 1.0 + mipmapLevel + roughnessLevel);
  float levelSize = max(64.0, width / levelSizeInPixels);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + roughnessLevel);
  float vOffset = (width - pow(2.0, maxLevel - roughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - mipmapLevel);
  vec2 uv = envMapOctahedral(dir, levelSize);
  uv *= levelSize;

  return (uv + vec2(hOffset, vOffset)) / width;
}
`;

var octMapUvToDir_glsl = /* glsl */ `
vec2 signed(vec2 v) {
  return step(0.0, v) * 2.0 - 1.0;
}

// size = target octMap size
vec3 octMapUVToDir (vec2 uv, float size) {
  // center pixels with texels
  // https://msdn.microsoft.com/en-us/library/windows/desktop/bb219690(v=vs.85).aspx
  // creates 2 pixel border on the seams so the texture will filter properly
  // uv = (uv * size - 0.5) / (size - 1.0); // THIS!!!

  // float uBorder = 5.0;
  // uv = uv * 2.0 - 1.0;
  // uv *= (size + uBorder) / size;
  // uv = (uv + 1.0) / 2.0;

  // if (uv.x < 0.0) { uv.x *= -1.0; uv.y = 1.0 - uv.y; }
  // else if (uv.x > 1.0) { uv.x = 2.0 - uv.x; uv.y = 1.0 - uv.y; }
  // if (uv.y < 0.0) { uv.y *= -1.0; uv.x = 1.0 - uv.x; }
  // else if (uv.y > 1.0) { uv.y = 2.0 - uv.y; uv.x = 1.0 - uv.x; }

  uv = uv * 2.0 - 1.0;

  vec2 auv = abs(uv);
  float len = dot(auv, vec2(1.0));

  if (len > 1.0) {
    //y < 0 case
    uv = (auv.yx - 1.0) * -1.0 * signed(uv);
  }
  return normalize(vec3(uv.x, 1.0 - len, uv.y));
}

// size = target octMap size
vec3 octMapUVToDir (vec2 uv) {
  // center pixels with texels
  // https://msdn.microsoft.com/en-us/library/windows/desktop/bb219690(v=vs.85).aspx
  // uv = (uv * size - 0.5) / (size - 1.0); // THIS!!!

  // uv = uv * 2.0 - 1.0;
  // uv *= (uTextureSize + uBorder) / uTextureSize;
  // uv = (uv + 1.0) / 2.0;

  // if (uv.x < 0.0) { uv.x *= -1.0; uv.y = 1.0 - uv.y; }
  // else if (uv.x > 1.0) { uv.x = 2.0 - uv.x; uv.y = 1.0 - uv.y; }
  // if (uv.y < 0.0) { uv.y *= -1.0; uv.x = 1.0 - uv.x; }
  // else if (uv.y > 1.0) { uv.y = 2.0 - uv.y; uv.x = 1.0 - uv.x; }

  uv = uv * 2.0 - 1.0;

  vec2 auv = abs(uv);
  float len = dot(auv, vec2(1.0));

  if (len > 1.0) {
    //y < 0 case
    uv = (auv.yx - 1.0) * -1.0 * signed(uv);
  }
  return normalize(vec3(uv.x, 1.0 - len, uv.y));
}
`;

var irradiance_glsl = /* glsl */ `
vec3 getIrradiance(vec3 normalWorld, sampler2D map, float width, int encoding) {
  vec2 uv = envMapOctahedral(normalWorld);
  float irrSize = 64.0;
  uv += 0.5 / irrSize;
  uv /= irrSize / (irrSize - 1.0);
  uv = (uv * irrSize + vec2(width - irrSize)) / width;
  return decode(texture2D(map, uv), encoding).rgb;
}
`;

var textureCoordinates_glsl = /* glsl */ `
vec2 getTextureCoordinates(in PBRData data, in int index) {
  #ifdef USE_TEXCOORD_1
    if (index == 1) return data.texCoord1;
  #endif

  return data.texCoord0;
}

vec2 getTextureCoordinates(in PBRData data, in int index, in mat3 texCoordTransform) {
  vec2 texCoord = getTextureCoordinates(data, index);

  return (texCoordTransform * vec3(texCoord.xy, 1)).xy;
}
`;

// uBaseColor: gltf assumes sRGB color, not linear
// uBaseColorTexture: assumes sRGB color, not linear
var baseColor_glsl = /* glsl */ `
uniform vec4 uBaseColor;

#ifdef USE_BASE_COLOR_TEXTURE
  uniform sampler2D uBaseColorTexture;

  #ifdef USE_BASE_COLOR_TEXTURE_MATRIX
    uniform mat3 uBaseColorTextureMatrix;
  #endif

  void getBaseColor(inout PBRData data) {
    #ifdef USE_BASE_COLOR_TEXTURE_MATRIX
      vec2 texCoord = getTextureCoordinates(data, BASE_COLOR_TEXTURE_TEX_COORD, uBaseColorTextureMatrix);
    #else
      vec2 texCoord = getTextureCoordinates(data, BASE_COLOR_TEXTURE_TEX_COORD);
    #endif
    vec4 texelColor = texture2D(uBaseColorTexture, texCoord);

    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.baseColor = decode(uBaseColor, SRGB).rgb * texelColor.rgb;
    #endif

    #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
        data.baseColor *= decode(vColor, SRGB).rgb;
      #endif
      data.opacity = uBaseColor.a * texelColor.a * vColor.a;
    #else
      data.opacity = uBaseColor.a * texelColor.a;
    #endif
  }
#else
  void getBaseColor(inout PBRData data) {
    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.baseColor = decode(uBaseColor, SRGB).rgb;
    #endif

    #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
        data.baseColor *= decode(vColor, SRGB).rgb;
      #endif
      data.opacity = uBaseColor.a * vColor.a;
    #else
      data.opacity = uBaseColor.a;
    #endif
  }
#endif
`;

// uEmissiveColor: gltf assumes sRGB color, not linear
// uEmissiveColorTexture: assumes sRGB color, not linear
var emissiveColor_glsl = /* glsl */ `
#ifdef USE_EMISSIVE_COLOR
  uniform vec4 uEmissiveColor;
  uniform float uEmissiveIntensity;
#endif

#ifdef USE_EMISSIVE_COLOR_TEXTURE
  uniform sampler2D uEmissiveColorTexture;

  #ifdef USE_EMISSIVE_COLOR_TEXTURE_MATRIX
    uniform mat3 uEmissiveColorTextureMatrix;
  #endif

  void getEmissiveColor(inout PBRData data) {
    #ifdef USE_EMISSIVE_COLOR_TEXTURE_MATRIX
      vec2 texCoord = getTextureCoordinates(data, EMISSIVE_COLOR_TEXTURE_TEX_COORD, uEmissiveColorTextureMatrix);
    #else
      vec2 texCoord = getTextureCoordinates(data, EMISSIVE_COLOR_TEXTURE_TEX_COORD);
    #endif

    data.emissiveColor = texture2D(uEmissiveColorTexture, texCoord).rgb;

    #ifdef USE_EMISSIVE_COLOR
      data.emissiveColor *= uEmissiveIntensity * decode(uEmissiveColor, SRGB).rgb;
    #endif

    #if defined(USE_INSTANCED_COLOR)
      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
        data.emissiveColor *= decode(vColor, SRGB).rgb;
      #endif
    #endif
  }
#elif defined(USE_EMISSIVE_COLOR)
  void getEmissiveColor(inout PBRData data) {
    data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, SRGB).rgb;
    #if defined(USE_INSTANCED_COLOR)
      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
        data.emissiveColor *= decode(vColor, SRGB).rgb;
      #endif
    #endif
  }
#else
  void getEmissiveColor(inout PBRData data) {
    data.emissiveColor = vec3(0.0);
  }
#endif
`;

// #elif defined(USE_DISPLACEMENT_TEXTURE)
//   uniform sampler2D uDisplacementMap;
//   uniform float uDisplacement;
//   uniform float uDisplacementNormalScale;
//   vec3 getNormal() {
//     float scale = uDisplacement * uDisplacementNormalScale;
//     float h = scale * texture2D(uDisplacementMap, texCoord).r;
//     float hx = scale * texture2D(uDisplacementMap, texCoord + vec2(1.0 / 2048.0, 0.0)).r;
//     float hz = scale * texture2D(uDisplacementMap, texCoord + vec2(0.0, 1.0 / 2048.0)).r;
//     float meshSize = 20.0;
//     vec3 a = vec3(0.0, h, 0.0);
//     vec3 b = vec3(1.0 / 2048.0 * meshSize, hx, 0.0);
//     vec3 c = vec3(0.0, hz, 1.0 / 2048.0 * meshSize);
//     vec3 N = normalize(cross(normalize(c - a), normalize(b - a)));
//     // FIXME: this is model space normal, need to multiply by modelWorld
//     // N = mat3(uModelMatrix) * N;
//     return N;
//   }
var normal_glsl = /* glsl */ `
#ifdef USE_NORMAL_TEXTURE
  uniform sampler2D uNormalTexture;
  uniform float uNormalTextureScale;

  #ifdef USE_NORMAL_TEXTURE_MATRIX
    uniform mat3 uNormalTextureMatrix;
  #endif

  void getNormal(inout PBRData data) {
    #ifdef USE_NORMAL_TEXTURE_MATRIX
      vec2 texCoord = getTextureCoordinates(data, NORMAL_TEXTURE_TEX_COORD, uNormalTextureMatrix);
    #else
      vec2 texCoord = getTextureCoordinates(data, NORMAL_TEXTURE_TEX_COORD);
    #endif

    vec3 normalMap = texture2D(uNormalTexture, texCoord).rgb * 2.0 - 1.0;
    normalMap.y *= uNormalTextureScale;
    normalMap = normalize(normalMap);

    vec3 N = normalize(data.normalView);
    vec3 V = normalize(data.eyeDirView);

    vec3 normalView;

    #ifdef USE_TANGENTS
      vec3 bitangent = cross(N, data.tangentView.xyz) * sign(data.tangentView.w);
      mat3 TBN = mat3(data.tangentView.xyz, bitangent, N);
      normalView = normalize(TBN * normalMap);
    #else
      normalMap.xy *= float(gl_FrontFacing) * 2.0 - 1.0;
      // make the output normalView match glTF expected right handed orientation
      normalMap.y *= -1.0;
      normalView = perturb(normalMap, N, V, texCoord);
    #endif
    data.normalView = normalView;
    data.normalWorld = normalize(vec3(data.inverseViewMatrix * vec4(normalView, 0.0)));
  }
#else
  void getNormal(inout PBRData data) {}
#endif
`;

// http://www.thetenthplanet.de/archives/1180
var normalPerturb_glsl = /* glsl */ `
#if !defined(USE_TANGENTS) && (defined(USE_NORMAL_TEXTURE) || defined(USE_CLEAR_COAT_NORMAL_TEXTURE))
  mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
    // get edge vectors of the pixel triangle
    highp vec3 dp1 = dFdx(p);
    highp vec3 dp2 = dFdy(p);
    highp vec2 duv1 = dFdx(uv);
    highp vec2 duv2 = dFdy(uv);

    // solve the linear system
    vec3 dp2perp = cross(dp2, N);
    vec3 dp1perp = cross(N, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

    // construct a scale-invariant frame
    float invmax = 1.0 / sqrt(max(dot(T,T), dot(B,B)));
    return mat3(normalize(T * invmax), normalize(B * invmax), N);
  }

  vec3 perturb(vec3 map, vec3 N, vec3 V, vec2 texcoord) {
    mat3 TBN = cotangentFrame(N, -V, texcoord);
    return normalize(TBN * map);
  }
#endif
`;

// uMetallicTexture: assumes linear, TODO: check glTF
// uRoughnessTexture: assumes linear, TODO: check glTF
//
// MIN_ROUGHNESS:
// Source: Google/Filament/Overview/4.8.3.3 Roughness remapping and clamping, 07/2019
// Minimum roughness to avoid division by zerio when 1/a^2 and to limit specular aliasing
// This could be 0.045 when using single precision float fp32
var metallicRoughness_glsl = /* glsl */ `
#ifdef USE_METALLIC_ROUGHNESS_WORKFLOW
  uniform float uMetallic;
  uniform float uRoughness;

  #define MIN_ROUGHNESS 0.089

  #ifdef USE_METALLIC_ROUGHNESS_TEXTURE
    // R = ?, G = roughness, B = metallic
    uniform sampler2D uMetallicRoughnessTexture;

    #ifdef USE_METALLIC_ROUGHNESS_TEXTURE_MATRIX
      uniform mat3 uMetallicRoughnessTextureMatrix;
    #endif

    // TODO: sampling the same texture twice
    void getMetallic(inout PBRData data) {
      #ifdef USE_METALLIC_ROUGHNESS_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, METALLIC_ROUGHNESS_TEXTURE_TEX_COORD, uMetallicRoughnessTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, METALLIC_ROUGHNESS_TEXTURE_TEX_COORD);
      #endif
      vec4 texelColor = texture2D(uMetallicRoughnessTexture, texCoord);
      data.metallic = uMetallic * texelColor.b;
      data.roughness = uRoughness * texelColor.g;
    }

    void getRoughness(inout PBRData data) {}
  #else
    #ifdef USE_METALLIC_TEXTURE
      uniform sampler2D uMetallicTexture;

      #ifdef USE_METALLIC_TEXTURE_MATRIX
        uniform mat3 uMetallicTextureMatrix;
      #endif

      void getMetallic(inout PBRData data) {
        #ifdef USE_METALLIC_TEXTURE_MATRIX
          vec2 texCoord = getTextureCoordinates(data, METALLIC_TEXTURE_TEX_COORD, uMetallicTextureMatrix);
        #else
          vec2 texCoord = getTextureCoordinates(data, METALLIC_TEXTURE_TEX_COORD);
        #endif
        data.metallic = uMetallic * texture2D(uMetallicTexture, texCoord).r;
      }
    #else
      void getMetallic(inout PBRData data) {
        data.metallic = uMetallic;
      }
    #endif

    #ifdef USE_ROUGHNESS_TEXTURE
      uniform sampler2D uRoughnessTexture;

      #ifdef USE_ROUGHNESS_TEXTURE_MATRIX
        uniform mat3 uRoughnessTextureMatrix;
      #endif

      void getRoughness(inout PBRData data) {

        #ifdef USE_ROUGHNESS_TEXTURE_MATRIX
          vec2 texCoord = getTextureCoordinates(data, ROUGHNESS_TEXTURE_TEX_COORD, uRoughnessTextureMatrix);
        #else
          vec2 texCoord = getTextureCoordinates(data, ROUGHNESS_TEXTURE_TEX_COORD);
        #endif
        data.roughness = uRoughness * texture2D(uRoughnessTexture, texCoord).r + 0.01;
      }
    #else
      void getRoughness(inout PBRData data) {
        data.roughness = uRoughness + 0.01;
      }
    #endif
  #endif
#endif
`;

// f0 and f90:
// https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_specular#implementation
// dielectricSpecularF0 = min(((ior - outside_ior) / (ior + outside_ior))^2 * specularColorFactor * specularColorTexture.rgb, float3(1.0)) * specularFactor * specularTexture.a
// dielectricSpecularF90 = specularFactor * specularTexture.a
var specular_glsl = /* glsl */ `
uniform float uIor;

const float OUTSIDE_IOR = 1.0; // Air

void getIor(inout PBRData data) {
  data.ior = uIor;
}

#if defined(USE_SPECULAR) && !defined(USE_SPECULAR_GLOSSINESS_WORKFLOW)
  uniform float uSpecular;
  uniform vec3 uSpecularColor;

  #ifdef USE_SPECULAR_TEXTURE
    uniform sampler2D uSpecularTexture;

    #ifdef USE_SPECULAR_TEXTURE_MATRIX
      uniform mat3 uSpecularTextureMatrix;
    #endif
  #endif

  #ifdef USE_SPECULAR_COLOR_TEXTURE
    uniform sampler2D uSpecularColorTexture;

    #ifdef USE_SPECULAR_COLOR_TEXTURE_MATRIX
      uniform mat3 uSpecularColorTextureMatrix;
    #endif
  #endif

  void getSpecular(inout PBRData data) {
    // Get specular strength and color
    float specularStrength = uSpecular;
    vec3 specularColor = uSpecularColor;

    // Factor in textures
    #ifdef USE_SPECULAR_TEXTURE
      #ifdef USE_SPECULAR_TEXTURE_MATRIX
        vec2 texCoordSpecular = getTextureCoordinates(data, SPECULAR_TEXTURE_TEX_COORD, uSpecularTextureMatrix);
      #else
        vec2 texCoordSpecular = getTextureCoordinates(data, SPECULAR_TEXTURE_TEX_COORD);
      #endif
      specularStrength *= texture2D(uSpecularTexture, texCoordSpecular).a;
    #endif

    #ifdef USE_SPECULAR_COLOR_TEXTURE
      #ifdef USE_SPECULAR_COLOR_TEXTURE_MATRIX
        vec2 texCoordSpecularColor = getTextureCoordinates(data, SPECULAR_COLOR_TEXTURE_TEX_COORD, uSpecularColorTextureMatrix);
      #else
        vec2 texCoordSpecularColor = getTextureCoordinates(data, SPECULAR_COLOR_TEXTURE_TEX_COORD);
      #endif
      specularColor *= texture2D(uSpecularColorTexture, texCoordSpecularColor).rgb;
    #endif

    data.f0 = mix(
      min(
        pow((data.ior - OUTSIDE_IOR) / (data.ior + OUTSIDE_IOR), 2.0) * specularColor,
        vec3(1.0)
      ) * specularStrength,
      data.baseColor.rgb,
      data.metallic
    );
    data.f90 = mix(vec3(specularStrength), vec3(1.0), data.metallic);
  }
#else
  void getSpecular(inout PBRData data) {
    // Compute F0 for both dielectric and metallic materials
    data.f0 = mix(
      vec3(pow((data.ior - OUTSIDE_IOR) /  (data.ior + OUTSIDE_IOR), 2.0)),
      data.baseColor.rgb,
      data.metallic
    );
    data.f90 = vec3(1.0);
  }
#endif
`;

var specularGlossiness_glsl = /* glsl */ `
#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW
  uniform vec4 uDiffuse;
  uniform vec3 uSpecular;
  uniform float uGlossiness;

  #ifdef USE_DIFFUSE_TEXTURE
    uniform sampler2D uDiffuseTexture;

    #ifdef USE_DIFFUSE_TEXTURE_MATRIX
      uniform mat3 uDiffuseTextureMatrix;
    #endif

    vec4 getDiffuse(in PBRData data) {
      // assumes sRGB texture
      #ifdef USE_DIFFUSE_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, DIFFUSE_TEXTURE_TEX_COORD, uDiffuseTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, DIFFUSE_TEXTURE_TEX_COORD);
      #endif
      vec4 texelColor = texture2D(uDiffuseTexture, texCoord);
      return vec4(decode(uDiffuse, SRGB).rgb, uDiffuse.a) * texelColor;
    }
  #else
    vec4 getDiffuse(in PBRData data) {
      return vec4(decode(uDiffuse, SRGB).rgb, uDiffuse.a);
    }
  #endif

  #ifdef USE_SPECULAR_GLOSSINESS_TEXTURE
    uniform sampler2D uSpecularGlossinessTexture;

    #ifdef USE_SPECULAR_GLOSSINESS_TEXTURE_MATRIX
      uniform mat3 uSpecularGlossinessTextureMatrix;
    #endif

    vec4 getSpecularGlossiness(in PBRData data) {
      // assumes specular is sRGB and glossiness is linear
      #ifdef USE_SPECULAR_GLOSSINESS_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, SPECULAR_GLOSSINESS_TEXTURE_TEX_COORD, uSpecularGlossinessTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, SPECULAR_GLOSSINESS_TEXTURE_TEX_COORD);
      #endif
      vec4 specGloss = texture2D(uSpecularGlossinessTexture, texCoord);
      //TODO: should i move uSpecular to linear?
      return vec4(uSpecular, uGlossiness) * specGloss;
    }
  #else
    vec4 getSpecularGlossiness(in PBRData data) {
      return vec4(uSpecular, uGlossiness);
    }
  #endif

  // assumes linear color
  float perceivedBrightness(vec3 c) {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  }

  float maxComponent(vec3 c) {
    return max(c.r, max(c.b, c.g));
  }

  float solveMetallic(float diffuse, float specular, float oneMinusSpecularStrength) {
    if (specular < 0.04) {
      return 0.0;
    }

    float a = 0.04;
    float b = diffuse * oneMinusSpecularStrength / (1.0 - a) + specular - 2.0 * a;
    float c = a - specular;
    float D = max(b * b - 4.0 * a * c, 0.0);
    return saturate((-b + sqrt(D)) / (2.0 * a));
  }

  void getBaseColorAndMetallicRoughnessFromSpecularGlossiness(inout PBRData data) {
    vec4 specularGlossiness = getSpecularGlossiness(data);

    vec3 specular = specularGlossiness.rgb;
    data.f0 = specular;

    float glossiness = specularGlossiness.a;
    data.roughness = 1.0 - glossiness;

    vec4 diffuseRGBA = getDiffuse(data);
    vec3 diffuse = diffuseRGBA.rgb;
    data.opacity = diffuseRGBA.a;
    float epsilon = 1e-6;
    float a = 0.04;

    // ported from https://github.com/KhronosGroup/glTF/blob/master/extensions/Khronos/KHR_materials_pbrSpecularGlossiness/examples/convert-between-workflows/js/three.pbrUtilities.js
    float oneMinusSpecularStrength = 1.0 - maxComponent(specular);
    data.metallic = solveMetallic(perceivedBrightness(diffuse), perceivedBrightness(specular), oneMinusSpecularStrength);

    vec3 baseColorFromDiffuse = diffuse * oneMinusSpecularStrength / (1.0 - a) / max(1.0 - data.metallic, epsilon);
    vec3 baseColorFromSpecular = (specular - a * (1.0 - data.metallic)) * (1.0 / max(data.metallic, epsilon));
    data.baseColor = mix(baseColorFromDiffuse, baseColorFromSpecular, data.metallic * data.metallic);

    #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
      vec3 tint = decode(vColor, SRGB).rgb;
      data.baseColor *= tint;
      data.f0 *= tint;
      data.opacity *= vColor.a;
    #endif
  }
#endif
`;

var clearCoat_glsl = /* glsl */ `
#ifdef USE_CLEAR_COAT
  uniform float uClearCoat;
  uniform float uClearCoatRoughness;

  #ifdef USE_CLEAR_COAT_TEXTURE
    uniform sampler2D uClearCoatTexture;

    #ifdef USE_CLEAR_COAT_TEXTURE_MATRIX
      uniform mat3 uClearCoatTextureMatrix;
    #endif

    void getClearCoat(inout PBRData data) {
      #ifdef USE_CLEAR_COAT_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_TEXTURE_TEX_COORD, uClearCoatTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_TEXTURE_TEX_COORD);
      #endif
      vec4 texelColor = texture2D(uClearCoatTexture, texCoord);

      data.clearCoat = uClearCoat * texelColor.r;

      #ifdef USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE
      data.clearCoatRoughness = uClearCoatRoughness * texelColor.g;
      #endif
    }
  #else
    void getClearCoat(inout PBRData data) {
      data.clearCoat = uClearCoat;
    }
  #endif

  #ifdef USE_CLEAR_COAT_ROUGHNESS_TEXTURE
    uniform sampler2D uClearCoatRoughnessTexture;

    #ifdef USE_CLEAR_COAT_ROUGHNESS_TEXTURE_MATRIX
      uniform mat3 uClearCoatRoughnessTextureMatrix;
    #endif

    void getClearCoatRoughness(inout PBRData data) {
      #ifdef USE_CLEAR_COAT_ROUGHNESS_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_ROUGHNESS_TEXTURE_TEX_COORD, uClearCoatRoughnessTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_ROUGHNESS_TEXTURE_TEX_COORD);
      #endif

      data.clearCoatRoughness = uClearCoatRoughness * texture2D(uClearCoatRoughnessTexture, texCoord).g;
    }
  #else
    void getClearCoatRoughness(inout PBRData data) {
      #if !defined(USE_CLEAR_COAT_ROUGHNESS_FROM_MAIN_TEXTURE)
      data.clearCoatRoughness = uClearCoatRoughness;
      #endif
    }
  #endif

  #ifdef USE_CLEAR_COAT_NORMAL_TEXTURE
    uniform sampler2D uClearCoatNormalTexture;
    uniform float uClearCoatNormalTextureScale;

    #ifdef USE_CLEAR_COAT_NORMAL_TEXTURE_MATRIX
      uniform mat3 uClearCoatNormalTextureMatrix;
    #endif

    void getClearCoatNormal(inout PBRData data) {
      #ifdef USE_CLEAR_COAT_NORMAL_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_TEXTURE_TEX_COORD, uClearCoatNormalTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_TEXTURE_TEX_COORD);
      #endif

      vec3 normalMap = texture2D(uClearCoatNormalTexture, texCoord).rgb * 2.0 - 1.0;
      normalMap.y *= uClearCoatNormalTextureScale;
      normalMap = normalize(normalMap);

      vec3 N = normalize(data.normalView);
      vec3 V = normalize(data.eyeDirView);

      vec3 normalView;

      #ifdef USE_TANGENTS
        vec3 bitangent = cross(N, data.tangentView.xyz) * sign(data.tangentView.w);
        mat3 TBN = mat3(data.tangentView.xyz, bitangent, N);
        normalView = normalize(TBN * normalMap);
      #else
        normalMap.xy *= float(gl_FrontFacing) * 2.0 - 1.0;
        // make the output normalView match glTF expected right handed orientation
        normalMap.y *= -1.0;
        normalView = perturb(normalMap, N, V, texCoord);
      #endif

      data.clearCoatNormal = normalize(vec3(data.inverseViewMatrix * vec4(normalView, 0.0)));
    }
  #else
    void getClearCoatNormal(inout PBRData data) {
      // geometric normal without perturbation from normalMap
      // this normal is in world space
      data.clearCoatNormal = normalize(vec3(data.inverseViewMatrix * vec4(normalize(vNormalView), 0.0)));
    }
  #endif


  // IOR = 1.5, F0 = 0.04
  // as material is no longer in contact with air we calculate new IOR on the
  // clear coat and material interface
  vec3 f0ClearCoatToSurface(const vec3 f0) {
    return saturate(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998);
  }
#endif
`;

// https://github.com/KhronosGroup/glTF/blob/master/extensions/2.0/Khronos/KHR_materials_sheen/README.md#albedo-scaling-technique
// Needs LUT
// https://dassaultsystemes-technology.github.io/EnterprisePBRShadingModel/spec-2021x.md.html#appendix/energycompensation/sheenbrdf
// data.sheenAlbedoScaling = 1.0 - max3(data.sheenColor) * E(VdotN)
// Rather than using up a precious sampler to store the LUT of our integral, we instead fit a curve to the data, which  is piecewise  separated by a sheen  roughness of 0.25.
// The energy reduction from sheen only varies between 0.13 and 0.18 across  roughness, so we approximate  it as a constant value  of 0.157.
// https://drive.google.com/file/d/1T0D1VSyR4AllqIJTQAraEIzjlb5h4FKH/view?usp=sharing
const getSheenAlbedoScaling = /* glsl */ `
void getSheenAlbedoScaling(inout PBRData data) {
  data.sheenAlbedoScaling = 1.0 - 0.157 * max3(data.sheenColor);
}
`;
// uSheenColor: gltf assumes sRGB color, not linear
// uSheenColorTexture: assumes sRGB color, not linear
var sheenColor_glsl = /* glsl */ `
#ifdef USE_SHEEN
  uniform vec4 uSheenColor;
  uniform float uSheenRoughness;

  #ifdef USE_SHEEN_COLOR_TEXTURE
    uniform sampler2D uSheenColorTexture;

    #ifdef USE_SHEEN_COLOR_TEXTURE_MATRIX
      uniform mat3 uSheenColorTextureMatrix;
    #endif

    void getSheenColor(inout PBRData data) {
      #ifdef USE_SHEEN_COLOR_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, SHEEN_COLOR_TEXTURE_TEX_COORD, uSheenColorTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, SHEEN_COLOR_TEXTURE_TEX_COORD);
      #endif
      vec4 texelColor = texture2D(uSheenColorTexture, texCoord);

      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.sheenColor = decode(uSheenColor, SRGB).rgb * texelColor.rgb;
      #endif

      #ifdef USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE
      data.sheenRoughness = uSheenRoughness * texelColor.a;
      #endif
    }
  #else
    void getSheenColor(inout PBRData data) {
      #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.sheenColor = decode(uSheenColor, SRGB).rgb;
      #endif
    }
  #endif

  #ifdef USE_SHEEN_ROUGHNESS_TEXTURE
    uniform sampler2D uSheenRoughnessTexture;

    #ifdef USE_SHEEN_ROUGHNESS_TEXTURE_MATRIX
      uniform mat3 uSheenRoughnessTextureMatrix;
    #endif

    void getSheenRoughness(inout PBRData data) {
      #ifdef USE_SHEEN_ROUGHNESS_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, SHEEN_ROUGHNESS_TEXTURE_TEX_COORD, uSheenRoughnessTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, SHEEN_ROUGHNESS_TEXTURE_TEX_COORD);
      #endif

      data.sheenRoughness = uSheenRoughness * texture2D(uSheenRoughnessTexture, texCoord).a;
    }
  #else
    void getSheenRoughness(inout PBRData data) {
      #if !defined(USE_SHEEN_ROUGHNESS_FROM_MAIN_TEXTURE)
      data.sheenRoughness = uSheenRoughness;
      #endif
    }
  #endif

 ${getSheenAlbedoScaling}
#endif
`;

var transmission_glsl = /* glsl */ `
#ifdef USE_TRANSMISSION
  uniform sampler2D uCaptureTexture;
#endif

#ifdef USE_TRANSMISSION
  uniform float uTransmission;
  uniform mat4 uProjectionMatrix;

  #ifdef USE_DISPERSION
    uniform float uDispersion;
  #endif

  #ifdef USE_TRANSMISSION_TEXTURE
    uniform sampler2D uTransmissionTexture;

    #ifdef USE_TRANSMISSION_TEXTURE_MATRIX
      uniform mat3 uTransmissionTextureMatrix;
    #endif

    void getTransmission(inout PBRData data) {
      #ifdef USE_TRANSMISSION_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, TRANSMISSION_TEXTURE_TEX_COORD, uTransmissionTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, TRANSMISSION_TEXTURE_TEX_COORD);
      #endif

      data.transmission = uTransmission * texture2D(uTransmissionTexture, texCoord).r;
    }
  #else
    void getTransmission(inout PBRData data) {
      data.transmission = uTransmission;
    }
  #endif

  float applyIorToRoughness(float roughness, float ior) {
    // Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
    // an IOR of 1.5 results in the default amount of microfacet refraction.
    return roughness * saturate(ior * 2.0 - 2.0);
  }

  vec3 getVolumeTransmissionRay(vec3 n, vec3 v, float thickness, float ior, mat4 modelMatrix) {
    // Direction of refracted light.
    vec3 refractionVector = refract(-v, normalize(n), 1.0 / ior);

    // Compute rotation-independant scaling of the model matrix.
    vec3 modelScale;
    modelScale.x = length(vec3(modelMatrix[0].xyz));
    modelScale.y = length(vec3(modelMatrix[1].xyz));
    modelScale.z = length(vec3(modelMatrix[2].xyz));

    // The thickness is specified in local space.
    return normalize(refractionVector) * thickness * modelScale;
  }
#endif

#if defined(USE_TRANSMISSION) || defined(USE_VOLUME)
  // Compute attenuated light as it travels through a volume.
  vec3 applyVolumeAttenuation(vec3 radiance, float transmissionDistance, vec3 attenuationColor, float attenuationDistance) {
    if (isinf(attenuationDistance) || attenuationDistance == 0.0) {
      // Attenuation distance is +∞ (which we indicate by zero or infinity), i.e. the transmitted color is not attenuated at all.
      return radiance;
    } else {
      // Compute light attenuation using Beer's law.
      vec3 transmittance = pow(attenuationColor, vec3(transmissionDistance / attenuationDistance));
      return transmittance * radiance;
    }
  }
#endif

#ifdef USE_VOLUME
  uniform float uThickness;
  uniform float uAttenuationDistance;
  uniform vec3 uAttenuationColor;

  #ifdef USE_THICKNESS_TEXTURE
    uniform sampler2D uThicknessTexture;

    #ifdef USE_THICKNESS_TEXTURE_MATRIX
      uniform mat3 uThicknessTextureMatrix;
    #endif

    void getThickness(inout PBRData data) {
      #ifdef USE_THICKNESS_TEXTURE_MATRIX
        vec2 texCoord = getTextureCoordinates(data, THICKNESS_TEXTURE_TEX_COORD, uThicknessTextureMatrix);
      #else
        vec2 texCoord = getTextureCoordinates(data, THICKNESS_TEXTURE_TEX_COORD);
      #endif

      data.thickness = uThickness * texture2D(uThicknessTexture, texCoord).g;
    }
  #else
    void getThickness(inout PBRData data) {
      data.thickness = uThickness;
    }
  #endif

  void getAttenuation(inout PBRData data) {
    data.attenuationColor = uAttenuationColor;
    data.attenuationDistance = uAttenuationDistance;
  }
#endif

#ifdef USE_DIFFUSE_TRANSMISSION
  uniform float uDiffuseTransmission;
  uniform vec3 uDiffuseTransmissionColor;

  #ifdef USE_DIFFUSE_TRANSMISSION_TEXTURE
    uniform sampler2D uDiffuseTransmissionTexture;

    #ifdef USE_DIFFUSE_TRANSMISSION_TEXTURE_MATRIX
      uniform mat3 uDiffuseTransmissionTextureMatrix;
    #endif
  #endif

  #ifdef USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE
    uniform sampler2D uDiffuseTransmissionColorTexture;

    #ifdef USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE_MATRIX
      uniform mat3 uDiffuseTransmissionColorTextureMatrix;
    #endif
  #endif

  void getDiffuseTransmission(inout PBRData data) {
    // Get diffuse transmission strength and color
    float diffuseTransmissionStrength = uDiffuseTransmission;
    vec3 diffuseTransmissionColor = uDiffuseTransmissionColor;

    // Factor in textures
    #ifdef USE_DIFFUSE_TRANSMISSION_TEXTURE
      #ifdef USE_DIFFUSE_TRANSMISSION_TEXTURE_MATRIX
        vec2 texCoordDiffuseTransmission = getTextureCoordinates(data, DIFFUSE_TRANSMISSION_TEXTURE_TEX_COORD, uDiffuseTransmissionTextureMatrix);
      #else
        vec2 texCoordDiffuseTransmission = getTextureCoordinates(data, DIFFUSE_TRANSMISSION_TEXTURE_TEX_COORD);
      #endif
      diffuseTransmissionStrength *= texture2D(uDiffuseTransmissionTexture, texCoordDiffuseTransmission).a;
    #endif

    #ifdef USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE
      #ifdef USE_DIFFUSE_TRANSMISSION_COLOR_TEXTURE_MATRIX
        vec2 texCoordDiffuseTransmissionColor = getTextureCoordinates(data, DIFFUSE_TRANSMISSION_COLOR_TEXTURE_TEX_COORD, uDiffuseTransmissionColorTextureMatrix);
      #else
        vec2 texCoordDiffuseTransmissionColor = getTextureCoordinates(data, DIFFUSE_TRANSMISSION_COLOR_TEXTURE_TEX_COORD);
      #endif
      diffuseTransmissionColor *= texture2D(uDiffuseTransmissionColorTexture, texCoordDiffuseTransmissionColor).rgb;
    #endif

    data.diffuseTransmission = diffuseTransmissionStrength;
    data.diffuseTransmissionColor = diffuseTransmissionColor;

    #ifdef USE_VOLUME
      data.diffuseTransmissionThickness = data.thickness * (length(vec3(uModelMatrix[0].xyz)) + length(vec3(uModelMatrix[1].xyz)) + length(vec3(uModelMatrix[2].xyz))) / 3.0;
    #else
      data.diffuseTransmissionThickness = 1.0;
    #endif
  }
#endif

#ifdef USE_TRANSMISSION
  // "Mipped Bicubic Texture Filtering" (https://www.shadertoy.com/view/4df3Dn)
  const float ONE_OVER_SIX = 1.0 / 6.0;
  float textureBicubicW0(float a) {
    return ONE_OVER_SIX * (a * (a * (-a + 3.0) - 3.0) + 1.0);
  }

  float textureBicubicW1(float a) {
    return ONE_OVER_SIX * (a * a * (3.0 * a - 6.0) + 4.0);
  }

  float textureBicubicW2(float a) {
    return ONE_OVER_SIX * (a * (a * (-3.0 * a + 3.0) + 3.0) + 1.0);
  }

  float textureBicubicW3(float a) {
    return ONE_OVER_SIX * (a * a * a);
  }

  // g0 and g1 are the two amplitude functions
  float textureBicubicG0(float a) {
    return textureBicubicW0(a) + textureBicubicW1(a);
  }

  float textureBicubicG1(float a) {
    return textureBicubicW2(a) + textureBicubicW3(a);
  }

  // h0 and h1 are the two offset functions
  float textureBicubicH0(float a) {
    return -1.0 + textureBicubicW1(a) / (textureBicubicW0(a) + textureBicubicW1(a));
  }

  float textureBicubicH1(float a) {
    return 1.0 + textureBicubicW3(a) / (textureBicubicW2(a) + textureBicubicW3(a));
  }

  vec4 textureBicubicSample(sampler2D tex, vec2 uv, vec4 texelSize, float lod) {
    uv = uv * texelSize.zw + 0.5;

    vec2 iuv = floor(uv);
    vec2 fuv = fract(uv);

    float g0x = textureBicubicG0(fuv.x);
    float g1x = textureBicubicG1(fuv.x);
    float h0x = textureBicubicH0(fuv.x);
    float h1x = textureBicubicH1(fuv.x);
    float h0y = textureBicubicH0(fuv.y);
    float h1y = textureBicubicH1(fuv.y);

    vec2 p0 = (vec2(iuv.x + h0x, iuv.y + h0y) - 0.5) * texelSize.xy;
    vec2 p1 = (vec2(iuv.x + h1x, iuv.y + h0y) - 0.5) * texelSize.xy;
    vec2 p2 = (vec2(iuv.x + h0x, iuv.y + h1y) - 0.5) * texelSize.xy;
    vec2 p3 = (vec2(iuv.x + h1x, iuv.y + h1y) - 0.5) * texelSize.xy;

    return (
      textureBicubicG0(fuv.y) *
        (g0x * textureLod(tex, p0, lod) + g1x * textureLod(tex, p1, lod)) +
      textureBicubicG1(fuv.y) *
        (g0x * textureLod(tex, p2, lod) + g1x * textureLod(tex, p3, lod))
    );
  }

  vec4 textureBicubic(sampler2D s, vec2 uv, float lod) {
    vec2 lodSizeFloor = vec2(textureSize(s, int(lod)));
    vec2 lodSizeCeil = vec2(textureSize(s, int(lod + 1.0)));

    vec2 lodSizeFloorInv = 1.0 / lodSizeFloor;
    vec2 lodSizeCeilInv = 1.0 / lodSizeCeil;

    vec4 floorSample = textureBicubicSample(s, uv, vec4(lodSizeFloorInv, lodSizeFloor), floor(lod));
    vec4 ceilSample = textureBicubicSample(s, uv, vec4(lodSizeCeilInv, lodSizeCeil), ceil(lod));

    return mix(floorSample, ceilSample, fract(lod));
  }
#endif
`;

// uAlphaTest: assumes sRGB color, not linear
var alpha_glsl = /* glsl */ `
#ifdef USE_ALPHA_TEXTURE
  uniform sampler2D uAlphaTexture;

  #ifdef USE_ALPHA_TEXTURE_MATRIX
    uniform mat3 uAlphaTextureMatrix;
  #endif
#endif

#ifdef USE_ALPHA_TEST
  uniform float uAlphaTest;

  void alphaTest(inout PBRData data) {
    if (data.opacity < uAlphaTest) discard;
  }
#endif
`;

// gtaoMultiBounce:
// Jimenez et al. 2016, "Practical Realtime Strategies for Accurate Indirect Occlusion"
// https://github.com/google/filament/blob/e1dfea0f121f3ee0e552fc010f0dde5ed9c7e783/shaders/src/ambient_occlusion.fs
// https://google.github.io/filament/Materials.md.html#materialdefinitions/materialblock/lighting:multibounceambientocclusion
// Returns a color ambient occlusion based on a pre-computed visibility term.
// The albedo term is meant to be the diffuse color or f0 for the diffuse and
// specular terms respectively.
var ambientOcclusion_glsl = /* glsl */ `
vec3 gtaoMultiBounce(float visibility, const vec3 albedo) {
  vec3 a =  2.0404 * albedo - 0.3324;
  vec3 b = -4.7951 * albedo + 0.6417;
  vec3 c =  2.7552 * albedo + 0.6903;

  return max(vec3(visibility), ((visibility * a + b) * visibility + c) * visibility);
}

void multiBounceAO(float visibility, const vec3 albedo, inout vec3 color) {
  color *= gtaoMultiBounce(visibility, albedo);
}

vec4 ssao(vec4 color, vec4 aoData, float intensity) {
  #ifdef USE_SSAO_COLORS
    vec3 rgb = mix(color.rgb, color.rgb * gtaoMultiBounce(aoData.a, color.rgb), intensity);
    color.rgb = vec3(rgb + aoData.rgb * color.rgb * 2.0);
    // color.rgb = vec3(color.rgb * (0.25 + 0.75 * aoData.a) + aoData.rgb * color.rgb * 2.0);
  #else
    color.rgb *= mix(vec3(1.0), vec3(aoData.r), intensity);
  #endif

  return color;
}

#ifdef USE_OCCLUSION_TEXTURE
  uniform sampler2D uOcclusionTexture;

  #ifdef USE_OCCLUSION_TEXTURE_MATRIX
    uniform mat3 uOcclusionTextureMatrix;
  #endif

  void getAmbientOcclusion(inout PBRData data) {
    #ifdef USE_OCCLUSION_TEXTURE_MATRIX
      vec2 texCoord = getTextureCoordinates(data, OCCLUSION_TEXTURE_TEX_COORD, uOcclusionTextureMatrix);
    #else
      vec2 texCoord = getTextureCoordinates(data, OCCLUSION_TEXTURE_TEX_COORD);
    #endif
    data.ao *= texture2D(uOcclusionTexture, texCoord).r;
  }
#endif
`;

// Read depth with different projection: https://stackoverflow.com/questions/7777913/how-to-render-depth-linearly-in-modern-opengl-with-gl-fragcoord-z-in-fragment-sh/45710371#45710371
// depthBufferValueToNdc: remap [0, 1] -> [-1, 1]
// ndcDepthToEyeSpace: http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
// ndcDepthToEyeSpaceOrtho: http://www.ogldev.org/www/tutorial47/tutorial47.html
var depthRead_glsl = /* glsl */ `
float depthBufferValueToNdc(float depth) {
  return 2.0 * depth - 1.0;
}

float ndcDepthToEyeSpace(float ndcDepth, float near, float far) {
  return 2.0 * near * far / (far + near - ndcDepth * (far - near));
}

float readDepth(sampler2D depthTexture, vec2 texCoord, float near, float far) {
  return ndcDepthToEyeSpace(
    depthBufferValueToNdc(texture2D(depthTexture, texCoord).r),
    near,
    far
  );
}

float ndcDepthToEyeSpaceOrtho(float ndcDepth, float near, float far) {
  return (far - near) * (ndcDepth + (far + near) / (far - near)) / 2.0;
}

float readDepthOrtho(sampler2D depthTexture, vec2 texCoord, float near, float far) {
  // return texture2D(depthTexture, texCoord).r * (far - near) + near;
  return ndcDepthToEyeSpaceOrtho(
    depthBufferValueToNdc(texture2D(depthTexture, texCoord).r),
    near,
    far
  );
}
`;

// reconstructPositionFromDepth:
// asumming z comes from depth buffer (ndc coords) and it's not a linear distance from the camera but
// perpendicular to the near/far clipping planes
// http://mynameismjp.wordpress.com/2010/09/05/position-from-depth-3/
// assumes z = eye space z
var depthPosition_glsl = /* glsl */ `
vec3 getFarViewDir(vec2 texCoord) {
  float hfar = 2.0 * tan(uFov/2.0) * uFar;
  float wfar = hfar * uViewportSize.x / uViewportSize.y;
  vec3 dir = (vec3(wfar * (texCoord.x - 0.5), hfar * (texCoord.y - 0.5), -uFar));
  return dir;
}

vec3 getViewRay(vec2 texCoord) {
  return normalize(getFarViewDir(texCoord));
}

vec3 reconstructPositionFromDepth(vec2 texCoord, float z) {
  vec3 ray = getFarViewDir(texCoord);
  vec3 pos = ray;
  return pos * z / uFar;
}
`;

var depthUnpack_glsl = /* glsl */ `
#ifndef DEPTH_PACK_FAR
  #define DEPTH_PACK_FAR 10.0
#endif

float unpackDepth (const in vec4 rgba_depth) {
  const vec4 bit_shift = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);
  float depth = dot(rgba_depth, bit_shift);
  return depth;
}
`;

// from http://spidergl.org/example.php?id=6
var depthPack_glsl = /* glsl */ `
#ifndef DEPTH_PACK_FAR
  #define DEPTH_PACK_FAR 10.0
#endif

vec4 packDepth(const in float depth) {
  const vec4 bit_shift = vec4(256.0*256.0*256.0, 256.0*256.0, 256.0, 1.0);
  const vec4 bit_mask  = vec4(0.0, 1.0/256.0, 1.0/256.0, 1.0/256.0);
  vec4 res = fract(depth * bit_shift);
  res -= res.xxyz * bit_mask;
  return res;
}
`;

/**
 * Fog
 *
 * Adapted from from Iñigo Quilez article: https://iquilezles.org/articles/fog/
 * @alias module:chunks.fog
 * @type {string}
 */ var fog_glsl = /* glsl */ `
uniform float uFogDensity;

uniform vec3 uSunColor;
uniform float uSunDispertion;
uniform float uSunIntensity;
uniform vec3 uInscatteringCoeffs;
uniform vec3 uFogColor;

vec3 fog(vec3 rgb, float dist, vec3 rayDir, vec3 sunDir) {
  vec3 sunColor = toLinear(uSunColor).rgb;
  vec3 fogColor = toLinear(uFogColor).rgb;

  float minSc         = 0.02;
  float density       = -(dist+1.0) * uFogDensity * 0.15 - dist * 0.0025;
  float sunAmount     = pow(max(dot(rayDir, sunDir), 0.0), 1.0 / (0.008 + uSunDispertion*3.0));
  sunAmount           = uSunIntensity * 10.0 * pow(sunAmount,10.0);
  sunAmount           = max(0.0, min(sunAmount, 1.0));
  vec3 sunFogColor    = mix(fogColor, sunColor, sunAmount);
  vec3 insColor       = vec3(1.0) - saturate( vec3(
        exp(density*(uInscatteringCoeffs.x+minSc)),
        exp(density*(uInscatteringCoeffs.y+minSc)),
        exp(density*(uInscatteringCoeffs.z+minSc)))
      );

  return mix(rgb, sunFogColor, insColor);
}
`;

// TODO: precompute luma in color attachment
// TODO: don't apply where there is strong motion blur or depth of field.
/**
 * FXAA
 *
 * Paper:
 * - https://developer.download.nvidia.com/assets/gamedev/files/sdk/11/FXAA_WhitePaper.pdf
 *
 * Reference Implementations:
 * - https://blog.simonrodriguez.fr/articles/2016/07/implementing_fxaa.html
 * - https://gist.github.com/kosua20/0c506b81b3812ac900048059d2383126
 *
 * Updates: Damien Seguin (2023-10)
 * @alias module:chunks.fxaa
 * @type {string}
 */ var fxaa_glsl = /* glsl */ `
#ifndef AA_QUALITY
  #define AA_QUALITY 2
#endif
#if AA_QUALITY == 0
  // Low
  #define FXAA_EDGE_THRESHOLD_MIN 0.0833 // 1 / 12
  #define FXAA_EDGE_THRESHOLD_MAX 0.250 // 1 / 4
#elif AA_QUALITY == 1
  // Medium
  #define FXAA_EDGE_THRESHOLD_MIN 0.0625 // 1 / 16
  #define FXAA_EDGE_THRESHOLD_MAX 0.166 // 1 / 6
#elif AA_QUALITY == 2
  // High
  #define FXAA_EDGE_THRESHOLD_MIN 0.0312 // 1 / 32
  #define FXAA_EDGE_THRESHOLD_MAX 0.125 // 1 / 8
#elif AA_QUALITY == 3
  // Ultra
  #define FXAA_EDGE_THRESHOLD_MIN 0.0156 // 1 / 64
  #define FXAA_EDGE_THRESHOLD_MAX 0.063 // 1 / 16
#elif AA_QUALITY == 4
  // Extreme
  #define FXAA_EDGE_THRESHOLD_MIN 0.0078 // 1 / 128
  #define FXAA_EDGE_THRESHOLD_MAX 0.031 // 1 / 32
#endif

#define FXAA_QUALITY(q) ((q) < 5 ? 1.0 : ((q) > 5 ? ((q) < 10 ? 2.0 : ((q) < 11 ? 4.0 : 8.0)) : 1.5))
#define FXAA_ITERATIONS 12

#define FXAA_ONE_OVER_TWELVE 1.0 / 12.0

// Performs FXAA post-process anti-aliasing as described in the Nvidia FXAA white paper and the associated shader code.
vec2 fxaa(
  sampler2D lumaTexture,
  vec2 uv,
  vec2 uvLeftUp,
  vec2 uvRightUp,
  vec2 uvLeftDown,
  vec2 uvRightDown,
  vec2 uvDown,
  vec2 uvUp,
  vec2 uvLeft,
  vec2 uvRight,
  vec2 texelSize,
  float subPixelQuality
) {
  // Luma at the current fragment
  float lumaCenter = readLumaTexture(lumaTexture, uv);

  // Luma at the four direct neighbours of the current fragment.
  float lumaDown = readLumaTexture(lumaTexture, uvDown);
  float lumaUp = readLumaTexture(lumaTexture, uvUp);
  float lumaLeft = readLumaTexture(lumaTexture, uvLeft);
  float lumaRight = readLumaTexture(lumaTexture, uvRight);

  // Find the maximum and minimum luma around the current fragment.
  float lumaMin = min(lumaCenter, min(min(lumaDown, lumaUp), min(lumaLeft, lumaRight)));
  float lumaMax = max(lumaCenter, max(max(lumaDown, lumaUp), max(lumaLeft, lumaRight)));

  // Compute the delta.
  float lumaRange = lumaMax - lumaMin;

  // If the luma variation is lower that a threshold (or if we are in a really dark area), we are not on an edge, don't perform any AA.
  if (lumaRange < max(FXAA_EDGE_THRESHOLD_MIN, lumaMax * FXAA_EDGE_THRESHOLD_MAX)) {
    return uv;
  }

  // Query the 4 remaining corners lumas.
  float lumaDownLeft = readLumaTexture(lumaTexture, uvLeftDown);
  float lumaUpRight = readLumaTexture(lumaTexture, uvRightUp);
  float lumaUpLeft = readLumaTexture(lumaTexture, uvLeftUp);
  float lumaDownRight = readLumaTexture(lumaTexture, uvRightDown);

  // Combine the four edges lumas (using intermediary variables for future computations with the same values).
  float lumaDownUp = lumaDown + lumaUp;
  float lumaLeftRight = lumaLeft + lumaRight;

  // Same for corners
  float lumaLeftCorners = lumaDownLeft + lumaUpLeft;
  float lumaDownCorners = lumaDownLeft + lumaDownRight;
  float lumaRightCorners = lumaDownRight + lumaUpRight;
  float lumaUpCorners = lumaUpRight + lumaUpLeft;

  // Compute an estimation of the gradient along the horizontal and vertical axis.
  float edgeHorizontal =
    abs(-2.0 * lumaLeft + lumaLeftCorners) +
    abs(-2.0 * lumaCenter + lumaDownUp) * 2.0 +
    abs(-2.0 * lumaRight + lumaRightCorners);
  float edgeVertical =
    abs(-2.0 * lumaUp + lumaUpCorners) +
    abs(-2.0 * lumaCenter + lumaLeftRight) * 2.0 +
    abs(-2.0 * lumaDown + lumaDownCorners);

  // Is the local edge horizontal or vertical ?
  bool isHorizontal = (edgeHorizontal >= edgeVertical);

  // Choose the step size (one pixel) accordingly.
  float stepLength = isHorizontal ? texelSize.y : texelSize.x;

  // Select the two neighboring texels lumas in the opposite direction to the local edge.
  float luma1 = isHorizontal ? lumaDown : lumaLeft;
  float luma2 = isHorizontal ? lumaUp : lumaRight;

  // Compute gradients in this direction.
  float gradient1 = abs(luma1 - lumaCenter);
  float gradient2 = abs(luma2 - lumaCenter);

  // Which direction is the steepest ?
  bool is1Steepest = gradient1 >= gradient2;

  // Gradient in the corresponding direction, normalized.
  float gradientScaled = 0.25 * max(gradient1, gradient2);

  // Average luma in the correct direction.
  float lumaLocalAverage = 0.0;
  if (is1Steepest) {
    // Switch the direction
    stepLength = - stepLength;
    lumaLocalAverage = 0.5 * (luma1 + lumaCenter);
  } else {
    lumaLocalAverage = 0.5 * (luma2 + lumaCenter);
  }

  // Shift UV in the correct direction by half a pixel.
  vec2 currentUv = uv;
  if (isHorizontal){
    currentUv.y += stepLength * 0.5;
  } else {
    currentUv.x += stepLength * 0.5;
  }

  // Compute offset (for each iteration step) in the right direction.
  vec2 offset = isHorizontal ? vec2(texelSize.x, 0.0) : vec2(0.0, texelSize.y);

  // Compute UVs to explore on each side of the edge, orthogonally. The QUALITY allows us to step faster.
  vec2 uv1 = currentUv - offset; // * QUALITY(0); // (quality 0 is 1.0)
  vec2 uv2 = currentUv + offset; // * QUALITY(0); // (quality 0 is 1.0)

  // Read the lumas at both current extremities of the exploration segment, and compute the delta wrt to the local average luma.
  float lumaEnd1 = readLumaTexture(lumaTexture, uv1);
  float lumaEnd2 = readLumaTexture(lumaTexture, uv2);
  lumaEnd1 -= lumaLocalAverage;
  lumaEnd2 -= lumaLocalAverage;

  // If the luma deltas at the current extremities is larger than the local gradient, we have reached the side of the edge.
  bool reached1 = abs(lumaEnd1) >= gradientScaled;
  bool reached2 = abs(lumaEnd2) >= gradientScaled;
  bool reachedBoth = reached1 && reached2;

  // If the side is not reached, we continue to explore in this direction.
  if (!reached1){
    uv1 -= offset; // * QUALITY(1); // (quality 1 is 1.0)
  }
  if (!reached2){
    uv2 += offset; // * QUALITY(1); // (quality 1 is 1.0)
  }

  // If both sides have not been reached, continue to explore.
  if (!reachedBoth)
  {
    for (int i = 2; i < FXAA_ITERATIONS; i++)
    {
      // If needed, read luma in 1st direction, compute delta.
      if (!reached1) {
        lumaEnd1 = readLumaTexture(lumaTexture, uv1);
        lumaEnd1 = lumaEnd1 - lumaLocalAverage;
      }
      // If needed, read luma in opposite direction, compute delta.
      if (!reached2) {
        lumaEnd2 = readLumaTexture(lumaTexture, uv2);
        lumaEnd2 = lumaEnd2 - lumaLocalAverage;
      }
      // If the luma deltas at the current extremities is larger than the local gradient, we have reached the side of the edge.
      reached1 = abs(lumaEnd1) >= gradientScaled;
      reached2 = abs(lumaEnd2) >= gradientScaled;
      reachedBoth = reached1 && reached2;

      // If the side is not reached, we continue to explore in this direction, with a variable quality.
      if (!reached1) {
        uv1 -= offset * FXAA_QUALITY(i);
      }
      if (!reached2) {
        uv2 += offset * FXAA_QUALITY(i);
      }

      // If both sides have been reached, stop the exploration.
      if (reachedBoth) {
        break;
      }
    }
  }

  // Compute the distances to each side edge of the edge (!).
  float distance1 = isHorizontal ? (uv.x - uv1.x) : (uv.y - uv1.y);
  float distance2 = isHorizontal ? (uv2.x - uv.x) : (uv2.y - uv.y);

  // In which direction is the side of the edge closer ?
  bool isDirection1 = distance1 < distance2;
  float distanceFinal = min(distance1, distance2);

  // Thickness of the edge.
  float edgeThickness = (distance1 + distance2);

  // Is the luma at center smaller than the local average ?
  bool isLumaCenterSmaller = lumaCenter < lumaLocalAverage;

  // If the luma at center is smaller than at its neighbour, the delta luma at each end should be positive (same variation).
  // (in the direction of the closer side of the edge.)
  bool correctVariation = ((isDirection1 ? lumaEnd1 : lumaEnd2) < 0.0) != isLumaCenterSmaller;

  // UV offset: read in the direction of the closest side of the edge.
  float pixelOffset = - distanceFinal / edgeThickness + 0.5;

  // If the luma variation is incorrect, do not offset.
  float finalOffset = correctVariation ? pixelOffset : 0.0;

  // Sub-pixel shifting
  // Full weighted average of the luma over the 3x3 neighborhood.
  float lumaAverage = FXAA_ONE_OVER_TWELVE * (2.0 * (lumaDownUp + lumaLeftRight) + lumaLeftCorners + lumaRightCorners);
  // Ratio of the delta between the global average and the center luma, over the luma range in the 3x3 neighborhood.
  float subPixelOffset1 = clamp(abs(lumaAverage - lumaCenter) / lumaRange, 0.0, 1.0);
  float subPixelOffset2 = smoothstep(0.0, 1.0, subPixelOffset1);
  // Compute a sub-pixel offset based on this delta.
  float subPixelOffsetFinal = subPixelOffset2 * subPixelOffset2 * subPixelQuality;

  // Pick the biggest of the two offsets.
  finalOffset = max(finalOffset, subPixelOffsetFinal);

  // Compute the final UV coordinates.
  vec2 finalUv = uv;
  if (isHorizontal){
    finalUv.y += finalOffset * stepLength;
  } else {
    finalUv.x += finalOffset * stepLength;
  }

  return finalUv;
}
`;

/**
 * Film Grain
 *
 * Reference Implementations:
 * - https://devlog-martinsh.blogspot.com/2013/05/image-imperfections-and-film-grain-post.html
 * - https://www.shadertoy.com/view/4sSXDW
 *
 * @alias module:chunks.filmGrain
 * @type {string}
 */ var filmGrain_glsl = /* glsl */ `
const vec3 FILM_GRAIN_TIME_OFFSET = vec3(0.07, 0.11, 0.13);
const vec2 FILM_GRAIN_CHANNEL_OFFSET = vec2(1.1, 1.2);

// Random
#if FILM_GRAIN_QUALITY == 0
  float filmGrainRandom(vec2 uv, float time) {
    return rand(uv * (1.0 + fract(time))) * 2.0 - 1.0;
  }
  vec3 filmGrainRandom(vec2 uv, float time, float size, float colorIntensity) {
    float n = filmGrainRandom(uv * size, time * FILM_GRAIN_TIME_OFFSET.x);

    return vec3(
      n,
      mix(n, filmGrainRandom(uv * FILM_GRAIN_CHANNEL_OFFSET.x * size, time * FILM_GRAIN_TIME_OFFSET.y), colorIntensity),
      mix(n, filmGrainRandom(uv * FILM_GRAIN_CHANNEL_OFFSET.y * size, time * FILM_GRAIN_TIME_OFFSET.z), colorIntensity)
    );
  }
// Large Film Grain Lottes
#elif FILM_GRAIN_QUALITY == 1
  float filmGrainLargeStep1(vec2 uv, float n) {
    float b = 2.0;
    float c = -12.0;

    return (1.0 / (4.0 + b * 4.0 + abs(c))) * (
      rand((uv + vec2(-1.0,-1.0)) + n) +
      rand((uv + vec2( 0.0,-1.0)) + n) * b +
      rand((uv + vec2( 1.0,-1.0)) + n) +
      rand((uv + vec2(-1.0, 0.0)) + n) * b +
      rand((uv + vec2( 0.0, 0.0)) + n) * c +
      rand((uv + vec2( 1.0, 0.0)) + n) * b +
      rand((uv + vec2(-1.0, 1.0)) + n) +
      rand((uv + vec2( 0.0, 1.0)) + n) * b +
      rand((uv + vec2( 1.0, 1.0)) + n)
    );
  }
  float filmGrainLargeStep2(vec2 uv, float n) {
    float b = 2.0;
    float c = 4.0;

    return (1.0 / (4.0 + b * 4.0 + c)) * (
      filmGrainLargeStep1(uv + vec2(-1.0, -1.0), n) +
      filmGrainLargeStep1(uv + vec2( 0.0, -1.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 1.0, -1.0), n) +
      filmGrainLargeStep1(uv + vec2(-1.0,  0.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 0.0,  0.0), n) * c +
      filmGrainLargeStep1(uv + vec2( 1.0,  0.0), n) * b +
      filmGrainLargeStep1(uv + vec2(-1.0,  1.0), n) +
      filmGrainLargeStep1(uv + vec2( 0.0,  1.0), n) * b +
      filmGrainLargeStep1(uv + vec2( 1.0,  1.0), n)
    );
  }
  vec3 filmGrainLarge(vec2 uv, float time, float size, float colorIntensity) {
    float scale = 18.0; // Match filmGrainRandom
    float n = filmGrainLargeStep2(uv * size, FILM_GRAIN_TIME_OFFSET.x * time);

    return scale * vec3(
      n,
      mix(n, filmGrainLargeStep2(uv * FILM_GRAIN_CHANNEL_OFFSET.x * size, FILM_GRAIN_TIME_OFFSET.y * time), colorIntensity),
      mix(n, filmGrainLargeStep2(uv * FILM_GRAIN_CHANNEL_OFFSET.y * size, FILM_GRAIN_TIME_OFFSET.z * time), colorIntensity)
    );
  }

// Upitis with periodic simplex noise
#elif FILM_GRAIN_QUALITY == 2
  const vec3 FILM_GRAIN_ROTATION_OFFSET = vec3(1.425, 3.892, 5.835);

  vec2 filmGrainRotate(vec2 uv, float angle, float aspect) {
    float cosAngle = cos(angle);
    float sinAngle = sin(angle);
    vec2 p = uv * 2.0 - 1.0;
    return vec2(
      (cosAngle * aspect * p.x - sinAngle * p.y) / aspect,
      cosAngle * p.y + sinAngle * aspect * p.x
    ) * 0.5 + 0.5;
  }

  float filmGrainUpitis(vec2 uv, float angle, vec2 offset, float aspect, float z, vec3 rep) {
    return pnoise(vec3(offset * filmGrainRotate(uv, angle, aspect), z), rep);
  }
  vec3 filmGrainUpitis(vec2 uv, float time, float size, float colorIntensity, vec2 viewportSize) {
    vec2 offset = viewportSize / vec2(size);
    float aspect = viewportSize.x / viewportSize.y;

    vec3 rep = vec3(uv + vec2(time), 1.0);
    float n = filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.x, offset, aspect, 0.0, rep);

    return vec3(
      n,
      mix(n, filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.y, offset, aspect, 1.0, rep), colorIntensity),
      mix(n, filmGrainUpitis(uv, time + FILM_GRAIN_ROTATION_OFFSET.z, offset, aspect, 2.0, rep), colorIntensity)
    );
  }
#endif

vec3 filmGrain(
  vec3 color,
  float luma,
  vec2 uv,
  vec2 viewportSize,
  float size,
  float intensity,
  float colorIntensity,
  float luminanceIntensity,
  float time
) {
  #if FILM_GRAIN_QUALITY == 0
    vec3 noise = filmGrainRandom(uv, time, size, colorIntensity);
  #elif FILM_GRAIN_QUALITY == 1
    vec3 noise = filmGrainLarge(uv, time, size, colorIntensity);
  #elif FILM_GRAIN_QUALITY == 2
    vec3 noise = filmGrainUpitis(uv, time, size, colorIntensity, viewportSize);
  #endif

  float luminance = mix(0.0, luma, luminanceIntensity);
  return saturate(color + mix(noise, vec3(0.0), pow(luminance + smoothstep(0.2, 0.0, luminance), 4.0)) * intensity);
}
`;

var lut_glsl = /* glsl */ `
vec4 lut(vec4 textureColor, sampler2D lookupTable, float lutSize) {
  float blueColor = textureColor.b * 63.0;

  vec2 quad1;
  quad1.y = floor(floor(blueColor) / 8.0);
  quad1.x = floor(blueColor) - (quad1.y * 8.0);

  vec2 quad2;
  quad2.y = floor(ceil(blueColor) / 8.0);
  quad2.x = ceil(blueColor) - (quad2.y * 8.0);

  float invSize = 1.0 / lutSize;
  float invHalfSize = 0.5 / lutSize;

  return mix(
    texture2D(
      lookupTable,
      vec2(
        (quad1.x * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.r),
        (quad1.y * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.g)
      )
    ),
    texture2D(
      lookupTable,
      vec2(
        (quad2.x * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.r),
        (quad2.y * 0.125) + invHalfSize + ((0.125 - invSize) * textureColor.g)
      )
    ),
    fract(blueColor)
  );
}
`;

/**
 * Color Correction
 *
 * https://github.com/CesiumGS/cesium/blob/master/Source/Shaders/Builtin/Functions
 * @alias module:chunks.colorCorrection
 * @type {string}
 */ var colorCorrection_glsl = /* glsl */ `
float brightnessContrast(float value, float brightness, float contrast) {
  return (value - 0.5) * contrast + 0.5 + brightness;
}

vec3 brightnessContrast(vec3 value, float brightness, float contrast) {
  return (value - 0.5) * contrast + 0.5 + brightness;
}

vec3 saturation(vec3 rgb, float adjustment) {
  const vec3 W = vec3(0.2125, 0.7154, 0.0721);
  vec3 intensity = vec3(dot(rgb, W));
  return mix(intensity, rgb, adjustment);
}

vec3 hue(vec3 rgb, float adjustment) {
  const mat3 toYIQ = mat3(0.299,     0.587,     0.114,
                          0.595716, -0.274453, -0.321263,
                          0.211456, -0.522591,  0.311135);
  const mat3 toRGB = mat3(1.0,  0.9563,  0.6210,
                          1.0, -0.2721, -0.6474,
                          1.0, -1.107,   1.7046);

  vec3 yiq = toYIQ * rgb;
  float hue = atan(yiq.z, yiq.y) + adjustment;
  float chroma = sqrt(yiq.z * yiq.z + yiq.y * yiq.y);

  vec3 color = vec3(yiq.x, chroma * cos(hue), chroma * sin(hue));
  return toRGB * color;
}
`;

// Alternatives:
// https://github.com/dataarts/3-dreams-of-black/blob/master/deploy/asset_viewer/js/rendering.js#L179
// vec2 coord = (uv - center) * vec2(radius);
// color.rgb = mix(color.rgb, vec3(1.0 - intensity), dot(coord, coord));
//
// color.rgb *= smoothstep(radius + (uFStop / intensity), radius + (uFStop / intensity), distance(uv, center));
var vignette_glsl = /* glsl */ `
vec3 vignette(in vec3 color, vec2 uv, float radius, float intensity) {
  const vec2 center = vec2(0.5);
  color.rgb *= smoothstep(-intensity, intensity, radius - distance(uv, center));
  return color;
}
`;

/**
 * Reversible Tone Map
 *
 * Reference Implementations:
 * - "Optimized Reversible Tonemapper for Resolve", Timothy Lottes: https://gpuopen.com/learn/optimized-reversible-tonemapper-for-resolve/
 * @alias module:chunks.reversibleToneMap
 * @type {string}
 */ var reversibleToneMap_glsl = /* glsl */ `
vec3 reversibleToneMap(vec3 c) {
  return c / (max3(c) + 1.0);
}
vec3 reversibleToneMapInverse(vec3 c) {
  return c / (1.0 - max3(c));
}
`;

var index$5 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  alpha: alpha_glsl,
  ambientOcclusion: ambientOcclusion_glsl,
  average: average_glsl,
  baseColor: baseColor_glsl,
  brdf: brdf_glsl,
  clearCoat: clearCoat_glsl,
  colorCorrection: colorCorrection_glsl,
  depthPack: depthPack_glsl,
  depthPosition: depthPosition_glsl,
  depthRead: depthRead_glsl,
  depthUnpack: depthUnpack_glsl,
  direct: direct_glsl,
  emissiveColor: emissiveColor_glsl,
  encodeDecode: encodeDecode_glsl,
  envMapEquirect: envMapEquirect_glsl,
  filmGrain: filmGrain_glsl,
  fog: fog_glsl,
  fxaa: fxaa_glsl,
  indirect: indirect_glsl,
  irradiance: irradiance_glsl,
  lightAmbient: lightAmbient_glsl,
  lightArea: lightArea_glsl,
  lightDirectional: lightDirectional_glsl,
  lightPoint: lightPoint_glsl,
  lightSpot: lightSpot_glsl,
  luma: luma_glsl,
  luminance: luminance_glsl,
  lut: lut_glsl,
  math: math_glsl,
  metallicRoughness: metallicRoughness_glsl,
  noise: noise_glsl,
  normal: normal_glsl,
  normalPerturb: normalPerturb_glsl,
  octMap: octMap_glsl,
  octMapUvToDir: octMapUvToDir_glsl,
  output: output_glsl,
  pcf: pcf_glsl,
  pcss: pcss_glsl,
  reversibleToneMap: reversibleToneMap_glsl,
  shadowing: shadowing_glsl,
  sheenColor: sheenColor_glsl,
  specular: specular_glsl,
  specularGlossiness: specularGlossiness_glsl,
  textureCoordinates: textureCoordinates_glsl,
  transmission: transmission_glsl,
  vignette: vignette_glsl
});

/**
 * @alias module:pipeline.blit.vert
 * @type {string}
 */ var blitVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

varying vec2 vTexCoord0;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord0 = aPosition * 0.5 + 0.5;
}
`;

/**
 * @alias module:pipeline.blit.frag
 * @type {string}
 */ var blitFrag = /* glsl */ `precision highp float;

${frag}

uniform sampler2D uTexture;

varying vec2 vTexCoord0;

// Includes
${max3}
${reversibleToneMap_glsl}
${encodeDecode_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);
  color = encode(color, SRGB);

  gl_FragColor = color;

  ${assignment}

  #define HOOK_FRAG_END
}`;

/**
 * @alias module:pipeline.reversibleToneMap.frag
 * @type {string}
 */ var reversibleToneMapFrag = /* glsl */ `precision highp float;

${frag}

uniform sampler2D uTexture;

varying vec2 vTexCoord0;

// Includes
${max3}
${reversibleToneMap_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);
  color.rgb = reversibleToneMapInverse(color.rgb);

  gl_FragColor = color;

  ${assignment}

  #define HOOK_FRAG_END
}`;

/**
 * @alias module:pipeline.depthPass.vert
 * @type {string}
 */ var depthPassVert = /* glsl */ `
${vert}

// Variables
attribute vec3 aPosition;

#ifdef USE_NORMALS
attribute vec3 aNormal;
#endif

#ifdef USE_TEXCOORD_0
attribute vec2 aTexCoord0;
#endif

#ifdef USE_TEXCOORD_1
attribute vec2 aTexCoord1;
#endif

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_INSTANCED_SCALE
attribute vec3 aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
attribute vec4 aRotation;
#endif

#ifdef USE_INSTANCED_COLOR
attribute vec4 aColor;
#endif

#ifdef USE_VERTEX_COLORS
attribute vec4 aVertexColor;
#endif

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif

#ifdef USE_SKIN
attribute vec4 aJoint;
attribute vec4 aWeight;
uniform mat4 uJointMat[NUM_JOINTS];
#endif

#ifdef USE_DISPLACEMENT_TEXTURE
uniform sampler2D uDisplacementTexture;
uniform float uDisplacement;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;

uniform float uPointSize;

float uDisplacementShadowStretch = 1.3;

varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
varying vec2 vTexCoord1;
#endif
varying vec3 vPositionView;

// Includes
${quatToMat4}

#define HOOK_VERT_DECLARATIONS_END

void main() {
  vec4 position = vec4(aPosition, 1.0);
  vec3 normal = vec3(0.0, 0.0, 0.0);
  vec2 texCoord = vec2(0.0, 0.0);
  vec4 positionView = vec4(0.0);

  #ifdef USE_NORMALS
    normal = aNormal;
  #endif

  #ifdef USE_TEXCOORD_0
    texCoord = aTexCoord0;
  #endif

  vTexCoord0 = texCoord;

  #ifdef USE_TEXCOORD_1
    vTexCoord1 = aTexCoord1;
  #endif

  #ifdef USE_INSTANCED_OFFSET
    vec3 offset = aOffset;
  #endif

  #ifdef USE_INSTANCED_SCALE
    vec3 scale = aScale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    vec4 rotation = aRotation;
  #endif

  #ifdef USE_INSTANCED_COLOR
    vec4 color = aColor;
  #endif

  #ifdef USE_VERTEX_COLORS
    vec4 vertexColor = aVertexColor;
  #endif

  #define HOOK_VERT_BEFORE_TRANSFORM

  #ifdef USE_DISPLACEMENT_TEXTURE
    float h = texture2D(uDisplacementTexture, aTexCoord0).r;
    position.xyz += uDisplacement * h * normal * uDisplacementShadowStretch;
  #endif

  #ifdef USE_INSTANCED_SCALE
    position.xyz *= scale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    mat4 rotationMat = quatToMat4(rotation);
    position = rotationMat * position;
    normal = vec3(rotationMat * vec4(normal, 0.0));
  #endif

  #ifdef USE_INSTANCED_OFFSET
    position.xyz += offset;
  #endif

  #if defined(USE_VERTEX_COLORS) && defined(USE_INSTANCED_COLOR)
    vColor = vertexColor * color;
  #else
    #ifdef USE_INSTANCED_COLOR
      vColor = color;
    #endif

    #ifdef USE_VERTEX_COLORS
      vColor = vertexColor;
    #endif
  #endif

  #ifdef USE_SKIN
    mat4 skinMat =
      aWeight.x * uJointMat[int(aJoint.x)] +
      aWeight.y * uJointMat[int(aJoint.y)] +
      aWeight.z * uJointMat[int(aJoint.z)] +
      aWeight.w * uJointMat[int(aJoint.w)];

    positionView = uViewMatrix * skinMat * position;
  #else
    positionView = uViewMatrix * uModelMatrix * position;
  #endif

  gl_Position = uProjectionMatrix * positionView;
  gl_PointSize = uPointSize;

  vPositionView = positionView.xyz;
  vNormalView = normalize(uNormalMatrix * normal);

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.depthPass.frag
 * @type {string}
 */ var depthPassFrag = /* glsl */ `
precision highp float;

${frag}

// Variables
varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
  varying vec2 vTexCoord1;
#endif
varying vec3 vPositionView;

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif

struct PBRData {
  vec2 texCoord0;
  vec2 texCoord1;
  float opacity;
};

// Includes
${textureCoordinates_glsl}
${baseColor_glsl}
${alpha_glsl}
${depthPack_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  PBRData data;
  data.texCoord0 = vTexCoord0;

  #ifdef USE_TEXCOORD_1
    data.texCoord1 = vTexCoord1;
  #endif

  getBaseColor(data);

  #ifdef USE_ALPHA_TEXTURE
    #ifdef ALPHA_TEXTURE_MATRIX
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD, uAlphaTextureMatrix);
    #else
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD);
    #endif
    data.opacity *= texture2D(uAlphaTexture, alphaTexCoord).r;
  #endif

  #ifdef USE_ALPHA_TEST
    alphaTest(data);
  #endif

  gl_FragColor = packDepth(length(vPositionView) / DEPTH_PACK_FAR);

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.depthPrePass.frag
 * @type {string}
 */ var depthPrePassFrag = /* glsl */ `
precision highp float;

${frag}

// Variables
varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
  varying vec2 vTexCoord1;
#endif
varying vec3 vPositionView;

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif

struct PBRData {
  vec2 texCoord0;
  vec2 texCoord1;
  float opacity;
};

// Includes
${textureCoordinates_glsl}
${baseColor_glsl}
${alpha_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  PBRData data;
  data.texCoord0 = vTexCoord0;

  #ifdef USE_TEXCOORD_1
    data.texCoord1 = vTexCoord1;
  #endif

  getBaseColor(data);

  #ifdef USE_ALPHA_TEXTURE
    #ifdef USE_ALPHA_TEXTURE_MATRIX
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD, uAlphaTextureMatrix);
    #else
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD);
    #endif
    data.opacity *= texture2D(uAlphaTexture, alphaTexCoord).r;
  #endif

  #ifdef USE_ALPHA_TEST
    alphaTest(data);
  #endif

  vec3 normal = vNormalView;
  normal *= float(gl_FrontFacing) * 2.0 - 1.0;

  gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.standard.frag
 * @type {string}
 */ var standardFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #extension GL_OES_standard_derivatives : require
  #ifdef USE_TRANSMISSION
    #extension GL_EXT_shader_texture_lod : require
  #endif
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

// Variables
uniform vec2 uViewportSize;

uniform highp mat4 uInverseViewMatrix;
uniform highp mat4 uViewMatrix;
uniform highp mat3 uNormalMatrix;
uniform highp mat4 uModelMatrix;

uniform vec3 uCameraPosition;

varying vec3 vNormalWorld;
varying vec3 vNormalView;

varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
  varying vec2 vTexCoord1;
#endif

varying highp vec3 vPositionWorld;
varying highp vec3 vPositionView;

#ifdef USE_TANGENTS
  varying vec4 vTangentView;
#endif

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif

struct PBRData {
  mat4 inverseViewMatrix;
  vec2 texCoord0;
  vec2 texCoord1;
  vec3 normalView;
  vec4 tangentView;
  vec3 positionWorld;
  vec3 positionView;
  vec3 eyeDirView;
  vec3 eyeDirWorld;
  vec3 normalWorld; // N, world space
  vec3 viewWorld; // V, view vector from position to camera, world space
  float NdotV;

  vec3 baseColor;
  vec3 emissiveColor;
  float opacity;
  float roughness; // roughness value, as authored by the model creator (input to shader)
  float metallic; // metallic value at the surface
  float linearRoughness; // roughness mapped to a more linear change in the roughness (proposed by [2])
  vec3 f0; // Reflectance at normal incidence, specular color
  vec3 f90; // Specular response at grazing incidence
  float clearCoat;
  float clearCoatRoughness;
  float clearCoatLinearRoughness;
  vec3 clearCoatNormal;
  vec3 reflectionWorld;
  vec3 directColor;
  vec3 diffuseColor; // color contribution from diffuse lighting
  vec3 indirectDiffuse; // contribution from IBL light probe and Ambient Light
  vec3 indirectSpecular; // contribution from IBL light probe and Area Light
  vec3 sheenColor;
  float sheenRoughness;
  float sheenLinearRoughness;
  vec3 sheen;
  float sheenAlbedoScaling;
  vec3 transmitted;
  float transmission;
  float diffuseTransmission;
  vec3 diffuseTransmissionColor;
  float diffuseTransmissionThickness;
  float thickness;
  vec3 attenuationColor;
  float attenuationDistance;
  float dispersion;
  float ior;
  float ao;
};

// Includes
${PI}
${TWO_PI}
${saturate}
${transposeMat3}
${multQuat}
${random}
${encodeDecode_glsl}
${textureCoordinates_glsl}
${baseColor_glsl}
${alpha_glsl}
${ambientOcclusion_glsl}
${max3}
${reversibleToneMap_glsl}

#ifndef USE_UNLIT_WORKFLOW
  // Lighting
  ${octMap_glsl}
  ${depthUnpack_glsl}
  ${depthRead_glsl}
  ${normalPerturb_glsl}
  ${irradiance_glsl}
  ${shadowing_glsl}
  ${brdf_glsl}
  ${specular_glsl}
  ${clearCoat_glsl}
  ${sheenColor_glsl}
  ${transmission_glsl}
  ${indirect_glsl}
  ${direct_glsl}
  ${lightAmbient_glsl}
  ${lightDirectional_glsl}
  ${lightPoint_glsl}
  ${lightSpot_glsl}
  ${lightArea_glsl}

  // Material and geometric context
  ${emissiveColor_glsl}
  ${normal_glsl}
  ${metallicRoughness_glsl}
  ${specularGlossiness_glsl}
#endif

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec3 color;

  PBRData data;
  data.texCoord0 = vTexCoord0;

  #ifdef USE_TEXCOORD_1
    data.texCoord1 = vTexCoord1;
  #endif

  #ifdef USE_UNLIT_WORKFLOW
    getBaseColor(data);

    color = data.baseColor;

    #ifdef USE_ALPHA_TEXTURE
      #ifdef USE_ALPHA_TEXTURE_MATRIX
        vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD, uAlphaTextureMatrix);
      #else
        vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD);
      #endif
      data.opacity *= texture2D(uAlphaTexture, alphaTexCoord).r;
    #endif
    #ifdef USE_ALPHA_TEST
      alphaTest(data);
    #endif
  #else
    data.inverseViewMatrix = uInverseViewMatrix;
    data.positionWorld = vPositionWorld;
    data.positionView = vPositionView;
    // TODO: is normalization needed for normalView, tangentView, normalWorld?
    data.normalView = normalize(vNormalView);
    data.normalView *= float(gl_FrontFacing) * 2.0 - 1.0;
    #ifdef USE_TANGENTS
      data.tangentView = normalize(vTangentView);
      data.tangentView *= float(gl_FrontFacing) * 2.0 - 1.0;
    #endif
    data.normalWorld = normalize(vNormalWorld);
    data.normalWorld *= float(gl_FrontFacing) * 2.0 - 1.0;
    data.eyeDirView = normalize(-vPositionView);
    data.eyeDirWorld = vec3(uInverseViewMatrix * vec4(data.eyeDirView, 0.0));
    data.indirectDiffuse = vec3(0.0);
    data.indirectSpecular = vec3(0.0);
    data.sheen = vec3(0.0);
    data.ao = 1.0;
    data.opacity = 1.0;

    // view vector in world space
    data.viewWorld = normalize(uCameraPosition - vPositionWorld);
    data.NdotV = saturate(abs(dot(data.normalWorld, data.viewWorld)) + FLT_EPS);

    #define HOOK_FRAG_BEFORE_TEXTURES

    getNormal(data);

    getEmissiveColor(data);

    #ifdef USE_METALLIC_ROUGHNESS_WORKFLOW
      getBaseColor(data);
      getRoughness(data);
      // TODO: avoid disappearing highlights at roughness 0
      // data.roughness = 0.004 + 0.996 * data.roughness;
      data.roughness = clamp(data.roughness, MIN_ROUGHNESS, 1.0);
      getMetallic(data);
    #endif

    #ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW
      getBaseColorAndMetallicRoughnessFromSpecularGlossiness(data);
    #endif

    #ifdef USE_ALPHA_TEXTURE
      #ifdef USE_ALPHA_TEXTURE_MATRIX
        vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD, uAlphaTextureMatrix);
      #else
        vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_TEXTURE_TEX_COORD);
      #endif
      data.opacity *= texture2D(uAlphaTexture, alphaTexCoord).r;
    #endif
    #ifdef USE_ALPHA_TEST
      alphaTest(data);
    #endif

    #ifdef USE_CLEAR_COAT
      getClearCoat(data);
      getClearCoatRoughness(data);

      data.clearCoatLinearRoughness = data.clearCoatRoughness * data.clearCoatRoughness;
      data.f0 = mix(data.f0, f0ClearCoatToSurface(data.f0), data.clearCoat);
      data.roughness = max(data.roughness, data.clearCoatRoughness);

      getClearCoatNormal(data);
    #endif

    #ifdef USE_SHEEN
      getSheenColor(data);
      getSheenRoughness(data);
      getSheenAlbedoScaling(data);

      data.sheenRoughness = max(data.sheenRoughness, MIN_ROUGHNESS);
      data.sheenLinearRoughness = data.sheenRoughness * data.sheenRoughness;
    #endif

    #ifdef USE_TRANSMISSION
      data.transmitted = vec3(0.0);
      #ifdef USE_DISPERSION
        data.dispersion = uDispersion;
      #endif
      getTransmission(data);
    #endif
    #ifdef USE_VOLUME
      getThickness(data);
      getAttenuation(data);
    #endif
    #ifdef USE_DIFFUSE_TRANSMISSION
      getDiffuseTransmission(data);
    #endif

    #ifdef USE_OCCLUSION_TEXTURE
      getAmbientOcclusion(data);
    #endif

    #define HOOK_FRAG_BEFORE_LIGHTING

    data.diffuseColor = data.baseColor * (1.0 - data.metallic);
    data.linearRoughness = data.roughness * data.roughness;

    #ifdef USE_METALLIC_ROUGHNESS_WORKFLOW
      getIor(data);
      getSpecular(data);
    #endif

    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
    #ifdef USE_REFLECTION_PROBES
      data.reflectionWorld = reflect(-data.eyeDirWorld, data.normalWorld);
      EvaluateLightProbe(data, data.ao);
    #endif
    #if NUM_AMBIENT_LIGHTS > 0
      #pragma unroll_loop
      for (int i = 0; i < NUM_AMBIENT_LIGHTS; i++) {
        EvaluateAmbientLight(data, uAmbientLights[i], data.ao);
      }
    #endif
    #if NUM_DIRECTIONAL_LIGHTS > 0
      #pragma unroll_loop
      for (int i = 0; i < NUM_DIRECTIONAL_LIGHTS; i++) {
        EvaluateDirectionalLight(data, uDirectionalLights[i], uDirectionalLightShadowMaps[i]);
      }
    #endif
    #if NUM_POINT_LIGHTS > 0
      #pragma unroll_loop
      for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
        EvaluatePointLight(data, uPointLights[i], uPointLightShadowMaps[i]);
      }
    #endif
    #if NUM_SPOT_LIGHTS > 0
      #pragma unroll_loop
      for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
        EvaluateSpotLight(data, uSpotLights[i], uSpotLightShadowMaps[i]);
      }
    #endif
    #if NUM_AREA_LIGHTS > 0
      #pragma unroll_loop
      for (int i = 0; i < NUM_AREA_LIGHTS; i++) {
        EvaluateAreaLight(data, uAreaLights[i], uAreaLightShadowMaps[i], data.ao);
      }
    #endif

    #define HOOK_FRAG_AFTER_LIGHTING

    color = data.emissiveColor + data.indirectDiffuse + data.indirectSpecular + data.directColor + data.transmitted;
  #endif // USE_UNLIT_WORKFLOW

  #ifdef USE_MSAA
    color.rgb = reversibleToneMap(color.rgb);
  #endif

  gl_FragData[0] = vec4(color, 1.0);

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(data.normalView * 0.5 + 0.5, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(data.emissiveColor, 1.0);
    #endif
  #endif
  #if defined(USE_BLEND) || defined(USE_TRANSMISSION)
    gl_FragData[0].a = data.opacity;
  #endif

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.standard.vert
 * @type {string}
 */ var standardVert = /* glsl */ `
${vert}

// Variables
attribute vec3 aPosition;

#ifdef USE_NORMALS
attribute vec3 aNormal;
#endif

#ifdef USE_TANGENTS
attribute vec4 aTangent;
varying vec4 vTangentView;
#endif

#ifdef USE_TEXCOORD_0
attribute vec2 aTexCoord0;
#endif

#ifdef USE_TEXCOORD_1
attribute vec2 aTexCoord1;
#endif

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_INSTANCED_SCALE
attribute vec3 aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
attribute vec4 aRotation;
#endif

#ifdef USE_INSTANCED_COLOR
attribute vec4 aColor;
#endif

#ifdef USE_VERTEX_COLORS
attribute vec4 aVertexColor;
#endif

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif

#ifdef USE_DISPLACEMENT_TEXTURE
uniform sampler2D uDisplacementTexture;
uniform mediump float uDisplacement;
#endif

#ifdef USE_SKIN
attribute vec4 aJoint;
attribute vec4 aWeight;
uniform mat4 uJointMat[NUM_JOINTS];
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uInverseViewMatrix;

uniform float uPointSize;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
varying vec2 vTexCoord1;
#endif
varying vec3 vPositionWorld;
varying vec3 vPositionView;

// Includes
${quatToMat4}

#define HOOK_VERT_DECLARATIONS_END

void main() {
  vec4 position = vec4(aPosition, 1.0);
  vec3 normal = vec3(0.0, 0.0, 0.0);
  vec2 texCoord = vec2(0.0, 0.0);

#ifdef USE_NORMALS
  normal = aNormal;
#endif

#ifdef USE_TANGENTS
  vec4 tangent = aTangent;
#endif

#ifdef USE_TEXCOORD_0
  texCoord = aTexCoord0;
#endif

  vTexCoord0 = texCoord;

#ifdef USE_TEXCOORD_1
  vTexCoord1 = aTexCoord1;
#endif

#ifdef USE_INSTANCED_OFFSET
  vec3 offset = aOffset;
#endif

#ifdef USE_INSTANCED_SCALE
  vec3 scale = aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
  vec4 rotation = aRotation;
#endif

#ifdef USE_INSTANCED_COLOR
  vec4 color = aColor;
#endif

#ifdef USE_VERTEX_COLORS
  vec4 vertexColor = aVertexColor;
#endif

#define HOOK_VERT_BEFORE_TRANSFORM

#ifdef USE_DISPLACEMENT_TEXTURE
  float h = texture2D(uDisplacementTexture, aTexCoord0).r;
  position.xyz += uDisplacement * h * normal;
#endif

#ifndef USE_SKIN
  #ifdef USE_INSTANCED_SCALE
    position.xyz *= scale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    mat4 rotationMat = quatToMat4(rotation);
    position = rotationMat * position;

    normal = vec3(rotationMat * vec4(normal, 0.0));
  #endif

  #ifdef USE_INSTANCED_OFFSET
    position.xyz += offset;
  #endif

  vec4 positionWorld = uModelMatrix * position;
  vNormalView = uNormalMatrix * normal;
#else
  vec4 positionWorld = uModelMatrix * position;

  mat4 skinMat =
    aWeight.x * uJointMat[int(aJoint.x)] +
    aWeight.y * uJointMat[int(aJoint.y)] +
    aWeight.z * uJointMat[int(aJoint.z)] +
    aWeight.w * uJointMat[int(aJoint.w)];

  normal = vec3(skinMat * vec4(normal, 0.0));

  positionWorld = skinMat * position;

  #ifdef USE_INSTANCED_SCALE
    positionWorld.xyz *= scale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    mat4 rotationMat = quatToMat4(rotation);
    positionWorld = rotationMat * positionWorld;

    normal = vec3(rotationMat * vec4(normal, 0.0));
  #endif

  #ifdef USE_INSTANCED_OFFSET
    positionWorld.xyz += offset;
  #endif

  #ifdef USE_TANGENTS
    tangent = skinMat * vec4(tangent.xyz, 0.0);
  #endif

  vNormalView = vec3(uViewMatrix * vec4(normal, 0.0));
#endif

#if defined(USE_VERTEX_COLORS) && defined(USE_INSTANCED_COLOR)
  vColor = vertexColor * color;
#else
  #ifdef USE_INSTANCED_COLOR
    vColor = color;
  #endif

  #ifdef USE_VERTEX_COLORS
    vColor = vertexColor;
  #endif
#endif


  vNormalWorld = normalize(vec3(uInverseViewMatrix * vec4(vNormalView, 0.0)));

  vec4 positionView = uViewMatrix * positionWorld;
  vec4 positionOut = uProjectionMatrix * positionView;

  vPositionWorld = positionWorld.xyz / positionWorld.w;
  vPositionView = positionView.xyz / positionView.w;
  gl_Position = positionOut;

  #ifdef USE_TANGENTS
    vTangentView.xyz = vec3(uNormalMatrix * tangent.xyz);
    vTangentView.w = tangent.w;
  #endif

  gl_PointSize = uPointSize;

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.basic.frag
 * @type {string}
 */ var basicFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

uniform vec4 uBaseColor;

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif

// Includes
${encodeDecode_glsl}
${max3}
${reversibleToneMap_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = decode(uBaseColor, SRGB);

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    color *= decode(vColor, SRGB);
  #endif

  #ifdef USE_MSAA
    color.rgb = reversibleToneMap(color.rgb);
  #endif

  gl_FragData[0] = color;

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >=0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >=0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}

  #define HOOK_FRAG_END
}`;

/**
 * @alias module:pipeline.basic.vert
 * @type {string}
 */ var basicVert = /* glsl */ `
${vert}

// Variables
attribute vec3 aPosition;

#ifdef USE_INSTANCED_OFFSET
attribute vec3 aOffset;
#endif

#ifdef USE_INSTANCED_SCALE
attribute vec3 aScale;
#endif

#ifdef USE_INSTANCED_ROTATION
attribute vec4 aRotation;
#endif

#ifdef USE_INSTANCED_COLOR
attribute vec4 aColor;
#endif

#ifdef USE_VERTEX_COLORS
attribute vec4 aVertexColor;
#endif

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

// Includes
${quatToMat4}

#define HOOK_VERT_DECLARATIONS_END

void main() {
  vec4 position = vec4(aPosition, 1.0);

  #ifdef USE_INSTANCED_OFFSET
    vec3 offset = aOffset;
  #endif

  #ifdef USE_INSTANCED_SCALE
    vec3 scale = aScale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    vec4 rotation = aRotation;
  #endif

  #ifdef USE_INSTANCED_COLOR
    vec4 color = aColor;
  #endif

  #ifdef USE_VERTEX_COLORS
    vec4 vertexColor = aVertexColor;
  #endif

  #define HOOK_VERT_BEFORE_TRANSFORM

  #ifdef USE_INSTANCED_SCALE
    position.xyz *= scale;
  #endif

  #ifdef USE_INSTANCED_ROTATION
    mat4 rotationMat = quatToMat4(rotation);
    position = rotationMat * position;
  #endif

  #ifdef USE_INSTANCED_OFFSET
    position.xyz += offset;
  #endif

  vec4 positionWorld = uModelMatrix * position;

#if defined(USE_VERTEX_COLORS) && defined(USE_INSTANCED_COLOR)
  vColor = vertexColor * color;
#else
  #ifdef USE_INSTANCED_COLOR
    vColor = color;
  #endif

  #ifdef USE_VERTEX_COLORS
    vColor = vertexColor;
  #endif
#endif

  vec4 positionView = uViewMatrix * positionWorld;
  vec4 positionOut = uProjectionMatrix * positionView;

  gl_Position = positionOut;

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.line.frag
 * @type {string}
 */ var lineFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

uniform vec4 uBaseColor;

#ifdef USE_VERTEX_COLORS
varying vec4 vColor;
#endif

// Includes
${encodeDecode_glsl}
${max3}
${reversibleToneMap_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = decode(uBaseColor, SRGB);

  #ifdef USE_VERTEX_COLORS
    color *= decode(vColor, SRGB);
  #endif

  #ifdef USE_MSAA
    color.rgb = reversibleToneMap(color.rgb);
  #endif

  gl_FragData[0] = color;

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.line.vert
 * @type {string}
 */ var lineVert = /* glsl */ `
${vert}

attribute vec3 aPosition;
attribute vec3 aPointA;
attribute vec3 aPointB;

#ifdef USE_VERTEX_COLORS
attribute vec4 aColorA;
attribute vec4 aColorB;

varying vec4 vColor;
#endif

#ifdef USE_INSTANCED_LINE_WIDTH
attribute vec2 aLineWidth;
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

uniform float uLineWidth;
uniform vec2 uResolution;

#define HOOK_VERT_DECLARATIONS_END

void main() {
  #ifdef USE_VERTEX_COLORS
    vColor = mix(aColorA, aColorB, aPosition.z);

    vec2 lineWidthScale = vec2(aColorA.a, aColorB.a);
  #else
    vec2 lineWidthScale = vec2(1.0);
  #endif

  if (length(aPointA) == 0.0 || length(aPointB) == 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    vec4 positionViewA = uViewMatrix * uModelMatrix * vec4(aPointA, 1.0);
    vec4 positionViewB = uViewMatrix * uModelMatrix * vec4(aPointB, 1.0);

    vec4 clip0 = uProjectionMatrix * positionViewA;
    vec4 clip1 = uProjectionMatrix * positionViewB;

    vec2 screen0 = uResolution * (0.5 * clip0.xy / clip0.w + 0.5);
    vec2 screen1 = uResolution * (0.5 * clip1.xy / clip1.w + 0.5);

    vec2 xBasis = normalize(screen1 - screen0);
    vec2 yBasis = vec2(-xBasis.y, xBasis.x);

    vec2 width = uLineWidth * (aPosition.x * xBasis + aPosition.y * yBasis);

    #ifdef USE_INSTANCED_LINE_WIDTH
      width *= aLineWidth;
    #endif

    // Heuristic for resolution scaling to be relative to height / 1000
    width *= uResolution.y * 0.001;

    vec2 pt0 = lineWidthScale.x * width;
    vec2 pt1 = lineWidthScale.y * width;

    #ifdef USE_PERSPECTIVE_SCALING
      pt0 /= -positionViewA.z;
      pt1 /= -positionViewB.z;
    #endif

    pt0 += screen0;
    pt1 += screen1;

    vec2 pt = mix(pt0, pt1, aPosition.z);
    vec4 clip = mix(clip0, clip1, aPosition.z);

    gl_Position = vec4(clip.w * ((2.0 * pt) / uResolution - 1.0), clip.z, clip.w);
  }

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.overlay.frag
 * @type {string}
 */ var overlayFrag = /* glsl */ `
precision highp float;

${frag}

varying vec2 vTexCoord0;
uniform sampler2D uTexture;

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  gl_FragColor = texture2D(uTexture, vTexCoord0);

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.overlay.vert
 * @type {string}
 */ var overlayVert = /* glsl */ `
${vert}

attribute vec2 aPosition;
attribute vec2 aTexCoord0;

uniform vec4 uBounds; // x, y, width, height

varying vec2 vTexCoord0;

#define HOOK_VERT_DECLARATIONS_END

void main() {
  vec2 pos = aPosition;
  pos = (pos + 1.0) / 2.0; // move from -1..1 to 0..1
  pos = vec2(
    uBounds.x + pos.x * uBounds.z,
    uBounds.y + pos.y * uBounds.w
  );
  pos = pos * 2.0 - 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
  vTexCoord0 = aTexCoord0;

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.helper.frag
 * @type {string}
 */ var helperFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

varying vec4 vColor;

// Includes
${encodeDecode_glsl}
${max3}
${reversibleToneMap_glsl}

#define HOOK_FRAG_DECLARATIONS_END

void main () {
  vec4 color = decode(vColor, SRGB);

  #ifdef USE_MSAA
    color.rgb = reversibleToneMap(color.rgb);
  #endif

  gl_FragData[0] = color;

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.helper.vert
 * @type {string}
 */ var helperVert = /* glsl */ `
${vert}

attribute vec3 aPosition;
attribute vec4 aVertexColor;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

varying vec4 vColor;

#define HOOK_VERT_DECLARATIONS_END

void main () {
  vColor = aVertexColor;
  gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);

  #define HOOK_VERT_END
}
`;

/**
 * @alias module:pipeline.error.frag
 * @type {string}
 */ var errorFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision mediump float;

${frag}

#define HOOK_FRAG_DECLARATIONS_END

void main () {
  gl_FragData[0] = vec4(1.0, 0.0, 0.0, 1.0);

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}

  #define HOOK_FRAG_END
}
`;

/**
 * @alias module:pipeline.error.vert
 * @type {string}
 */ var errorVert = /* glsl */ `
${vert}

attribute vec3 aPosition;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

#define HOOK_VERT_DECLARATIONS_END

void main () {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);

  #define HOOK_VERT_END
}
`;

/**
 * @member {object}
 * @static
 */ const blit = {
    vert: blitVert,
    frag: blitFrag
};
/**
 * @member {object}
 * @static
 */ const reversibleToneMap = {
    frag: reversibleToneMapFrag
};
/**
 * @member {object}
 * @static
 */ const depthPass = {
    vert: depthPassVert,
    frag: depthPassFrag
};
/**
 * @member {object}
 * @static
 */ const depthPrePass = {
    frag: depthPrePassFrag
};
/**
 * @member {object}
 * @static
 */ const standard = {
    vert: standardVert,
    frag: standardFrag
};
/**
 * @member {object}
 * @static
 */ const basic = {
    vert: basicVert,
    frag: basicFrag
};
/**
 * @member {object}
 * @static
 */ const line = {
    vert: lineVert,
    frag: lineFrag
};
/**
 * @member {object}
 * @static
 */ const overlay = {
    vert: overlayVert,
    frag: overlayFrag
};
/**
 * @member {object}
 * @static
 */ const helper = {
    vert: helperVert,
    frag: helperFrag
};
/**
 * @member {object}
 * @static
 */ const error = {
    vert: errorVert,
    frag: errorFrag
};

var index$4 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  basic: basic,
  blit: blit,
  depthPass: depthPass,
  depthPrePass: depthPrePass,
  error: error,
  helper: helper,
  line: line,
  overlay: overlay,
  reversibleToneMap: reversibleToneMap,
  standard: standard
});

/**
 * @alias module:postProcessing.postProcessing.vert
 * @type {string}
 */ var postProcessingVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

uniform vec2 uViewportSize;

varying vec2 vTexCoord0;

#if defined(USE_FXAA) || defined(USE_UPSAMPLE) || defined(USE_DOWN_SAMPLE)
  uniform vec2 uTexelSize;

  varying vec2 vTexCoord0LeftUp;
  varying vec2 vTexCoord0RightUp;
  varying vec2 vTexCoord0LeftDown;
  varying vec2 vTexCoord0RightDown;

  #if defined(USE_FXAA) || defined(USE_UPSAMPLE)
    varying vec2 vTexCoord0Down;
    varying vec2 vTexCoord0Up;
    varying vec2 vTexCoord0Left;
    varying vec2 vTexCoord0Right;
  #endif
#endif

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord0 = aPosition * 0.5 + 0.5;

  #if defined(USE_FXAA) || defined(USE_UPSAMPLE) || defined(USE_DOWN_SAMPLE)
    #if defined(USE_UPSAMPLE) && defined(QUALITY) && QUALITY == 0
      float offset = 0.5;
    #else
      float offset = 1.0;
    #endif

    vTexCoord0LeftUp = vTexCoord0 + uTexelSize * offset * vec2(-1.0, 1.0);
    vTexCoord0RightUp = vTexCoord0 + uTexelSize * offset * vec2(1.0, 1.0);
    vTexCoord0LeftDown = vTexCoord0 + uTexelSize * offset * vec2(-1.0, -1.0);
    vTexCoord0RightDown = vTexCoord0 + uTexelSize * offset * vec2(1.0, -1.0);

    #if defined(USE_FXAA) || defined(USE_UPSAMPLE)
      vTexCoord0Down = vTexCoord0 + uTexelSize * vec2(0.0, -1.0);
      vTexCoord0Up = vTexCoord0 + uTexelSize * vec2(0.0, 1.0);
      vTexCoord0Left = vTexCoord0 + uTexelSize * vec2(-1.0, 0.0);
      vTexCoord0Right = vTexCoord0 + uTexelSize * vec2(1.0, 0.0);
    #endif
  #endif
}
`;

/**
 * GTAO (Ground Truth)
 *
 * Paper: https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf
 *
 * Reference Implementation: https://github.com/GameTechDev/XeGTAO/blob/master/Source/Rendering/Shaders/XeGTAO.hlsli
 *
 * Updates: Damien Seguin (2023-10)
 * @alias module:postProcessing.gtao.frag
 * @type {string}
 */ var gtaoFrag = /* glsl */ `
precision highp float;

// Required defines:
// Number of hemisphere slices:
// NUM_SLICES 11
// Number of sample per slice:
// NUM_SAMPLES 7

// Optional defines:
// USE_NOISE_TEXTURE
// USE_COLOR_BOUNCE

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

#ifdef USE_NOISE_TEXTURE
  uniform sampler2D uNoiseTexture;
  uniform float uNoiseTextureSize;
#endif

uniform float uNear;
uniform float uFar;
uniform float uFov;

uniform float uIntensity;
uniform float uRadius; // world (viewspace) maximum size of the shadow
uniform float uBias;
uniform float uBrightness;
uniform float uContrast;

#ifdef USE_COLOR_BOUNCE
uniform float uColorBounceIntensity;
#endif

// Includes
${saturate}
${round}
${HALF_PI}
${PI}
${TWO_PI}
${depthRead_glsl}
${depthPosition_glsl}
${colorCorrection_glsl}

const float NUM_SLICES_FLOAT = float(NUM_SLICES);
const float NUM_SAMPLES_FLOAT = float(NUM_SAMPLES);
const float COLOR_DIVIDER = (NUM_SAMPLES_FLOAT * NUM_SLICES_FLOAT) * 2.0;

vec3 getPositionView(vec2 uv) {
  // TODO: sample depth from miplevel
  return reconstructPositionFromDepth(uv, readDepth(uDepthTexture, uv, uNear, uFar));
}

vec3 addColorBounce(vec3 normalView, vec2 uv, vec3 horizon, float radius) {
  return texture2D(uTexture, uv).rgb *
    saturate(dot(normalize(horizon), normalView)) *
    pow(1.0 - saturate(length(horizon) / radius), 2.0);
}

#define FALLOFF_RANGE 0.615 // distant samples contribute less
#define SAMPLE_DISTRIBUTION_POWER 2.0 // small crevices more important than big surfaces

// if the offset is under approx pixel size (pixelTooCloseThreshold), push it out to the minimum distance
const float pixelTooCloseThreshold = 1.3;

void main() {
  float visibility = 0.0;

  #ifdef USE_COLOR_BOUNCE
    vec3 color = vec3(0.0);
  #endif

  vec2 vUV = gl_FragCoord.xy * uTexelSize;
  vec3 centerPositionView = getPositionView(vUV);

  float depth = saturate(smoothstep(uNear, uFar, -centerPositionView.z));

  if (depth >= 1.0) {
    visibility = 1.0;
  } else {
    vec3 normalView = texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0;

    vec3 viewVec = normalize(-centerPositionView);

    float sampleDistributionPower = SAMPLE_DISTRIBUTION_POWER;
    float thinOccluderCompensation = uBias;
    float falloffRange = FALLOFF_RANGE * uRadius;

    float falloffFrom = uRadius * (1.0 - FALLOFF_RANGE);

    // fadeout precompute optimisation
    float falloffMul = -1.0 / falloffRange;
    float falloffAdd = falloffFrom / falloffRange + 1.0;

    // Get the screen space radius
    float projScale = 1.0 / (2.0 * tan(uFov * 0.5));
    float viewspaceZ = texture2D(uDepthTexture, vUV).x;
    // const vec2 pixelDirRBViewspaceSizeAtCenterZ = viewspaceZ.xx * consts.NDCToViewMul_x_PixelSize;
    float pixelDirRBViewspaceSizeAtCenterZ = viewspaceZ * (projScale * uTexelSize.x);
    float screenspaceRadius = uRadius / pixelDirRBViewspaceSizeAtCenterZ;

    #ifdef USE_NOISE_TEXTURE
      vec2 noise = texture2D(uNoiseTexture, gl_FragCoord.xy / uNoiseTextureSize).xy;
      float noiseSlice = noise.x;
      float noiseSample = noise.y;
    #else
      // Rotation jitter approach from
      // https://github.com/MaxwellGengYF/Unity-Ground-Truth-Ambient-Occlusion/blob/9cc30e0f31eb950a994c71866d79b2798d1c508e/Shaders/GTAO_Common.cginc#L152-L155
      float noiseSlice = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float jitterMod = (gl_FragCoord.x + gl_FragCoord.y) * 0.25;
      float noiseSample = mod(jitterMod, 1.0) * (screenspaceRadius / NUM_SAMPLES_FLOAT) * 0.25;
    #endif

    // fade out for small screen radii
    visibility += saturate((10.0 - screenspaceRadius) / 100.0) * 0.5;

    if (screenspaceRadius < pixelTooCloseThreshold) {
      gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      return;
    }

    // this is the min distance to start sampling from to avoid sampling from the center pixel (no useful data obtained from sampling center pixel)
    float minS = pixelTooCloseThreshold / screenspaceRadius;

    for (int slice = 0; slice < NUM_SLICES; slice++) {
      float sliceFloat = float(slice);
      float sliceK = (sliceFloat + noiseSlice) / NUM_SLICES_FLOAT;
      float phi = sliceK * PI;
      float cosPhi = cos(phi);
      float sinPhi = sin(phi);
      vec2 omega = vec2(cosPhi, sinPhi);

      // convert to screen units (pixels) for later use
      omega *= screenspaceRadius;

      vec3 directionVec = vec3(cosPhi, sinPhi, 0);
      vec3 orthoDirectionVec = directionVec - (dot(directionVec, viewVec) * viewVec);
      // axisVec is orthogonal to directionVec and viewVec, used to define projectedNormal
      vec3 axisVec = normalize(cross(orthoDirectionVec, viewVec));
      vec3 projectedNormalVec = normalView - axisVec * dot(normalView, axisVec);

      float signNorm = sign(dot(orthoDirectionVec, projectedNormalVec));
      float projectedNormalVecLength = length(projectedNormalVec);
      float cosNorm = saturate(dot(projectedNormalVec, viewVec) / projectedNormalVecLength);
      float n = signNorm * acos(cosNorm);

      // this is a lower weight target; not using -1 as in the original paper because it is under horizon, so a 'weight' has different meaning based on the normal
      float lowHorizonCos0 = cos(n + HALF_PI);
      float lowHorizonCos1 = cos(n - HALF_PI);

      float horizonCos0 = lowHorizonCos0;
      float horizonCos1 = lowHorizonCos1;

      for (int j = 0; j < NUM_SAMPLES; j++) {
        float stepFloat = float(j);
        float stepNoise = fract(
          noiseSample +
          // R1 sequence (http://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/)
          (sliceFloat + stepFloat * NUM_SAMPLES_FLOAT) * 0.6180339887498948482
        );

        // Snap to pixel center (more correct direction math, avoids artifacts due to sampling pos not matching depth texel center - messes up slope - but adds other
        // artifacts due to them being pushed off the slice). Also use full precision for high res cases.
        vec2 sampleOffset = round(
          (
            // minS to avoid sampling center pixel
            pow((stepFloat + stepNoise) / NUM_SAMPLES_FLOAT, sampleDistributionPower) + minS
          ) * omega
        ) * uTexelSize;

        vec2 sampleScreenPos0 = vUV + sampleOffset;
        vec2 sampleScreenPos1 = vUV - sampleOffset;

        vec3 sampleDelta0 = getPositionView(sampleScreenPos0) - centerPositionView;
        vec3 sampleDelta1 = getPositionView(sampleScreenPos1) - centerPositionView;
        float sampleDist0 = length(sampleDelta0);
        float sampleDist1 = length(sampleDelta1);

        #ifdef USE_COLOR_BOUNCE
          color += addColorBounce(normalView, sampleScreenPos0, sampleDelta0, uRadius);
          color += addColorBounce(normalView, sampleScreenPos1, sampleDelta1, uRadius);
        #endif

        vec3 sampleHorizonVec0 = vec3(sampleDelta0 / sampleDist0);
        vec3 sampleHorizonVec1 = vec3(sampleDelta1 / sampleDist1);

        // this is our own thickness heuristic that relies on sooner discarding samples behind the center
        float falloffBase0 = length(vec3(sampleDelta0.x, sampleDelta0.y, sampleDelta0.z * (1.0 + thinOccluderCompensation)));
        float falloffBase1 = length(vec3(sampleDelta1.x, sampleDelta1.y, sampleDelta1.z * (1.0 + thinOccluderCompensation)));
        float weight0 = saturate(falloffBase0 * falloffMul + falloffAdd);
        float weight1 = saturate(falloffBase1 * falloffMul + falloffAdd);

        // sample horizon cos
        float shc0 = dot(sampleHorizonVec0, viewVec);
        float shc1 = dot(sampleHorizonVec1, viewVec);

        // discard unwanted samples
        // this would be more correct but too expensive: cos(mix(acos(lowHorizonCosN), acos(shcN), weightN));
        shc0 = mix(lowHorizonCos0, shc0, weight0);
        shc1 = mix(lowHorizonCos1, shc1, weight1);

        // thicknessHeuristic disabled
        // https://github.com/GameTechDev/XeGTAO/tree/master#thin-occluder-conundrum
        horizonCos0 = max(horizonCos0, shc0);
        horizonCos1 = max(horizonCos1, shc1);
      }

      // I can't figure out the slight overdarkening on high slopes, so I'm adding this fudge - in the training set, 0.05 is close (PSNR 21.34) to disabled (PSNR 21.45)
      projectedNormalVecLength = mix(projectedNormalVecLength, 1.0, 0.05);

      float h0 = 2.0 * -acos(horizonCos1);
      float h1 = 2.0 * acos(horizonCos0);

      visibility += projectedNormalVecLength * (
        (cosNorm + h0 * sin(n) - cos(h0 - n)) +
        (cosNorm + h1 * sin(n) - cos(h1 - n))
      ) * 0.25;
    }

    visibility = max(0.03, pow(visibility / NUM_SLICES_FLOAT, 1.0 + uIntensity));
  }

  visibility = saturate(brightnessContrast(visibility, uBrightness, uContrast));

  #ifdef USE_COLOR_BOUNCE
    color /= COLOR_DIVIDER / uColorBounceIntensity;
    gl_FragColor = vec4(color, visibility);
  #else
    gl_FragColor = vec4(visibility, 0.0, 0.0, 1.0);
  #endif

  ${assignment}
}
`;

/**
 * SAO (Scalable Ambient Obscurance)
 *
 * Paper: https://research.nvidia.com/sites/default/files/pubs/2012-06_Scalable-Ambient-Obscurance/McGuire12SAO.pdf
 * (https://casual-effects.com/research/McGuire2012SAO/index.html)
 *
 * Reference Implementation: https://gist.github.com/transitive-bullshit/6770311
 *
 * Updates: Marcin Ignac (2017-05-08) and Damien Seguin (2023-10)
 * @alias module:postProcessing.sao.frag
 * @type {string}
 */ var saoFrag = /* glsl */ `
precision highp float;

// Required defines:
// Number of direct samples to take at each pixel:
// NUM_SAMPLES 11
// Number of turns around the circle that the spiral pattern makes (should be
// prime number to prevent taps from lining up):
// NUM_SPIRAL_TURNS 7

// Optional defines:
// USE_NOISE_TEXTURE

${frag}

uniform sampler2D uDepthTexture;
uniform sampler2D uNormalTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

#ifdef USE_NOISE_TEXTURE
  uniform sampler2D uNoiseTexture;
  uniform float uNoiseTextureSize;
#endif

uniform float uNear;
uniform float uFar;
uniform float uFov;

uniform float uIntensity; // Darkening factor
uniform float uRadius; // World-space AO radius in scene units (r).  e.g., 1.0m
uniform float uBias; // Bias to avoid AO in smooth corners, e.g., 0.01m
uniform float uBrightness;
uniform float uContrast;

// Includes
${saturate}
${random}
${TWO_PI}
${depthRead_glsl}
${depthPosition_glsl}
${colorCorrection_glsl}

const float RADIUS_MULTIPLIER = 500.0;
const float EPSILON = 0.01;

const float NUM_SAMPLES_FLOAT = float(NUM_SAMPLES);
const float INV_NUM_SAMPLES = 1.0 / NUM_SAMPLES_FLOAT;
const float NUM_SPIRAL_TURNS_TIMES_TWO_PI = float(NUM_SPIRAL_TURNS) * TWO_PI;

vec3 getPositionView(vec2 uv) {
  return reconstructPositionFromDepth(uv, readDepth(uDepthTexture, uv, uNear, uFar));
}

vec3 getOffsetPositionView(vec2 uv, vec2 unitOffset, float radiusScreen) {
  return getPositionView(uv + radiusScreen * unitOffset * uTexelSize);
}

// Returns a unit vector and a screen-space radius for the tap on a unit disk (the caller should scale by the actual disk radius)
vec2 tapLocation(int sampleNumber, float spinAngle, out float radiusScreen) {
  // Radius relative to radiusScreen
  float alpha = (float(sampleNumber) + 0.5) * INV_NUM_SAMPLES;
  float angle = alpha * (NUM_SPIRAL_TURNS_TIMES_TWO_PI) + spinAngle;

  radiusScreen = alpha;
  return vec2(cos(angle), sin(angle));
}

float sampleAO(vec2 uv, vec3 positionView, vec3 normalView, float sampleRadiusScreen, int tapIndex, float rotationAngle, float radius2) {
  // Offset on the unit disk, spun for this pixel
  float radiusScreen = 0.0;
  vec2 unitOffset = tapLocation(tapIndex, rotationAngle, radiusScreen);
  radiusScreen *= sampleRadiusScreen;

  // The occluding point in camera space
  vec3 v = getOffsetPositionView(uv, unitOffset, radiusScreen) - positionView;

  float vv = dot(v, v);
  float vn = dot(v, normalView) - uBias;

  float f = max(radius2 - vv, 0.0) / radius2;
  return f * f * f * max(vn / (EPSILON + vv), 0.0);
}

void main() {
  float visibility = 0.0;

  vec2 vUV = gl_FragCoord.xy * uTexelSize;
  vec3 originView = getPositionView(vUV);

  float depth = saturate(smoothstep(uNear, uFar, -originView.z));

  if (depth >= 1.0) {
    visibility = 1.0;
  } else {
    vec3 normalView = texture2D(uNormalTexture, vUV).rgb * 2.0 - 1.0;

    #ifdef USE_NOISE_TEXTURE
      float noise = texture2D(uNoiseTexture, gl_FragCoord.xy / uNoiseTextureSize).r;
    #else
      // Rotation jitter approach from
      // https://github.com/MaxwellGengYF/Unity-Ground-Truth-Ambient-Occlusion/blob/9cc30e0f31eb950a994c71866d79b2798d1c508e/Shaders/GTAO_Common.cginc#L152-L155
      float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    #endif

    float randomPatternRotationAngle = rand(gl_FragCoord.xy) * TWO_PI * noise;

    float radius = uRadius * RADIUS_MULTIPLIER;
    float projScale = 1.0 / (2.0 * tan(uFov * 0.5));
    float radiusScreen = projScale * radius / originView.z;

    float radius2 = radius * radius;

    for (int i = 0; i < NUM_SAMPLES; ++i) {
      visibility += sampleAO(vUV, originView, normalView, radiusScreen, i, randomPatternRotationAngle, radius2);
    }

    visibility = max(0.03, pow(1.0 - visibility / (4.0 * NUM_SAMPLES_FLOAT), 1.0 + uIntensity));
  }

  // Brightness/contrast adjust
  visibility = saturate(brightnessContrast(visibility, uBrightness, uContrast));

  gl_FragColor = vec4(visibility, 0.0, 0.0, 1.0);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.bilateralBlur.frag
 * @type {string}
 */ var bilateralBlurFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uViewportSize;

uniform float uNear;
uniform float uFar;

uniform vec2 uDirection;
uniform float uSharpness;

${depthRead_glsl}

// Blur weight based on https://github.com/nvpro-samples/gl_ssao/blob/master/hbao_blur.frag.glsl
// const int numSamples = 9;
// const float blurRadius = float(numSamples) / 2.0;
// const float blurSigma = blurRadius * 0.5;
// const float blurFalloff = 1.0 / (2.0*blurSigma*blurSigma);
const float blurFalloff = 0.09876543210;

vec4 bilateralBlur(sampler2D image, vec2 imageResolution, sampler2D depthTexture, vec2 uv, vec2 direction) {
  vec4 color = vec4(0.0);

  float centerDepth = readDepth(depthTexture, uv, uNear, uFar);

  float weightSum = 0.0;

  for (float i = -8.0; i <= 8.0; i += 2.0) {
    float r = i;
    vec2 off = direction * r;
    float sampleDepth = readDepth(depthTexture, uv + (off / imageResolution), uNear, uFar);
    float diff = (sampleDepth - centerDepth) * uSharpness;
    float weight = exp2(-r * r * blurFalloff - diff * diff);
    weightSum += weight;
    color += texture2D(image, uv + (off / imageResolution)) * weight;
  }

  color /= weightSum;

  return color;
}

void main() {
  vec2 vUV = gl_FragCoord.xy / uViewportSize;
  gl_FragColor = bilateralBlur(uTexture, uViewportSize, uDepthTexture, vUV, uDirection);

  ${assignment}
}
`;

/**
 * DoF (Depth of Field)
 *
 * Based on:
 * - "Bokeh depth of field in a single pass", Dennis Gustafsson: https://blog.voxagon.se/2018/05/04/bokeh-depth-of-field-in-single-pass.html
 * - "GLSL depth of field with bokeh v2.4", Martins Upitis: https://devlog-martinsh.blogspot.com/2011/12/glsl-depth-of-field-with-bokeh-v24.html
 * @alias module:postProcessing.dof.frag
 * @type {string}
 */ var dofFrag = /* glsl */ `
precision highp float;

// Required defines:
// USE_DOF_GUSTAFSSON or USE_DOF_UPITIS
// NUM_SAMPLES 6

// Optional defines:
// USE_PHYSICAL
// USE_FOCUS_ON_SCREEN_POINT
// USE_DEBUG
// USE_SHAPE_PENTAGON

${frag}

uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

uniform float uNear;
uniform float uFar;
uniform float uFocusScale; // Non physically based value

#ifdef USE_PHYSICAL
  uniform float uFStop;
  uniform float uFocalLength;
#endif

uniform float uChromaticAberration;
uniform float uLuminanceThreshold;
uniform float uLuminanceGain;

#ifdef USE_FOCUS_ON_SCREEN_POINT
  uniform vec2 uScreenPoint;
#else
  uniform float uFocusDistance;
#endif

varying vec2 vTexCoord0;

// Use a default circle of confusion for simplicity sake instead of sensor dimensions
// 35mm film has a 24x36mm frame size which result in (43mm diagonal / 1500 enlargement of sensor size) = 0.029mm CoC
const float CoC = 0.029;

// Includes
${luma_glsl}
${depthRead_glsl}
${saturate}
#ifdef USE_DOF_UPITIS
  ${TWO_PI}
  ${random}
#endif

// Apply chromatic aberration
vec3 processSample(vec2 coords, float blur, vec2 texelSize) {
  vec2 scale = texelSize * uChromaticAberration * blur;

  vec3 color = vec3(
    texture2D(uTexture, coords + vec2(0.0, 1.0) * scale).r,
    texture2D(uTexture, coords + vec2(-0.866, -0.5) * scale).g,
    texture2D(uTexture, coords + vec2(0.866, -0.5) * scale).b
  );

  float threshold = max((luma(color) - uLuminanceThreshold) * uLuminanceGain, 0.0);

  return color + mix(vec3(0.0), color, threshold * blur);
}

float getCoC(float depth, float focusDistance, float focusScale) {
  #ifdef USE_PHYSICAL
    float plane = (depth * uFocalLength) / (depth - uFocalLength);
    float far = (focusDistance * uFocalLength) / (focusDistance - uFocalLength);
    float near = (focusDistance - uFocalLength) / (focusDistance * uFStop * focusScale * CoC); // focusScale !== 1.0 makes it non-physical
    return saturate(abs(plane - far) * near);
  #else
    float coc = clamp((1.0 / focusDistance - 1.0 / depth) * focusScale, -1.0, 1.0); // (1 / mm - 1 / mm) * mm = mm
    return abs(coc);
  #endif
}

#ifdef USE_DEBUG
  vec3 dofDebug(vec2 texCoord, float focusDistance, float blur, float focusScale) {
    if (texCoord.x > 0.90) {
      float cameraDepth = (uFar - uNear) * 1000.0; // m -> mm
      float depth = texCoord.y * cameraDepth; // uv * mm = mm

      // CoC
      if (texCoord.x <= 0.95) {
        float t = (texCoord.x - 0.9) * 20.0;
        float coc = getCoC(depth, focusDistance, focusScale);
        if (coc > t) return vec3(1.0);
        return vec3(0.0);
      }

      // Focus distance
      if (texCoord.x > 0.97) {
        // Relative to camera depth (using 2.5% of camera depth)
        if (abs(depth - focusDistance) < cameraDepth * 0.0025) return vec3(1.0, 1.0, 0.0);
        return vec3(floor(texCoord.y * 10.0)) / 10.0;
      }

      // Focal length and f-stop
      #ifdef USE_PHYSICAL
        float H = uFocalLength * uFocalLength / (uFStop * CoC); //mm
      #else
        float H = focusScale;
      #endif
      float near = H * focusDistance / (H + focusDistance);
      float far = H * focusDistance / (H - focusDistance);

      if (abs(depth - H) < cameraDepth * 0.0025) return vec3(1.0, 1.0, 0.0); // ?
      if (depth < near) return vec3(1.0, 0.0, 0.0); // Foreground
      if (depth > far) return vec3(0.0, 0.0, 1.0); // Background

      return vec3(0.0, 1.0, 0.0);
    }
    // Blur amount in scene
    return vec3(floor(abs(blur) / 0.1 * 100.0) / 100.0, 0.0, 0.0);
  }
#endif

// Gustafsson
#ifdef USE_DOF_GUSTAFSSON
  const float GOLDEN_ANGLE = 2.39996323;  // rad
  const float MAX_BLUR_SIZE = 30.0;
  const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster

  vec3 depthOfFieldGustafsson(vec2 texCoord, float focusDistance, float centerSize, float focusScale, float centerDepth) {
    #ifdef USE_DEBUG
      if (texCoord.x > 0.5) return dofDebug(vTexCoord0, focusDistance, centerSize, focusScale);
    #endif

    // Get blur size
    centerSize *= MAX_BLUR_SIZE;

    vec3 color = texture2D(uTexture, texCoord).rgb;
    float tot = 1.0;
    float radius = RAD_SCALE;

    // Heuristic to make DoF resolution independent
    float resolutionScale = pow(uViewportSize.y / 1080.0, 2.0);
    float maxRadius = MAX_BLUR_SIZE * resolutionScale;

    for (float ang = 0.0; ang < maxRadius * float(NUM_SAMPLES); ang += GOLDEN_ANGLE) {
      vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * uTexelSize * radius;

      float sampleDepth = readDepth(uDepthTexture, tc, uNear, uFar) * 1000.0; // m -> mm;
      float sampleSize = getCoC(sampleDepth, focusDistance, focusScale) * MAX_BLUR_SIZE; // mm

      if (sampleDepth > centerDepth) {
        // Controls how much of the background gets blended into a blurry foreground
        // Unphysical, to approximate the occluded information behind the foreground object
        sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
      }

      float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);

      color += mix(color / tot, processSample(tc, m, uTexelSize), m);
      tot += 1.0;

      radius += RAD_SCALE / radius * resolutionScale;

      if (radius > maxRadius) break;
    }
    return color /= tot;
  }
#endif

// Upitis
#ifdef USE_DOF_UPITIS
  const int RINGS = 4; //ring count
  const int MAX_RING_SAMPLES = RINGS * NUM_SAMPLES;

  float maxBlur = 1.0;
  float bias = 0.5; // bokeh edge bias
  float namount = 0.0001; //dither amount

  #ifdef USE_SHAPE_PENTAGON
    float feather = 0.4; // pentagon shape feather

    float pentagon(vec2 coords, float rings) {
      float scale = rings - 1.3;
      vec4 HS0 = vec4( 1.0,         0.0,         0.0,  1.0);
      vec4 HS1 = vec4( 0.309016994, 0.951056516, 0.0,  1.0);
      vec4 HS2 = vec4(-0.809016994, 0.587785252, 0.0,  1.0);
      vec4 HS3 = vec4(-0.809016994,-0.587785252, 0.0,  1.0);
      vec4 HS4 = vec4( 0.309016994,-0.951056516, 0.0,  1.0);
      vec4 HS5 = vec4( 0.0        ,0.0         , 1.0,  1.0);

      vec4 one = vec4(1.0);

      vec4 P = vec4((coords),vec2(scale, scale));

      vec4 dist = vec4(0.0);
      float inorout = -4.0;

      dist.x = dot(P, HS0);
      dist.y = dot(P, HS1);
      dist.z = dot(P, HS2);
      dist.w = dot(P, HS3);

      dist = smoothstep(-feather, feather, dist);

      inorout += dot( dist, one );

      dist.x = dot(P, HS4);
      dist.y = HS5.w - abs(P.z);

      dist = smoothstep(-feather, feather, dist);
      inorout += dist.x;

      return saturate(inorout);
    }
  #endif

  vec3 depthOfFieldUpitis(vec2 texCoord, float focusDistance, float blur, float focusScale) {
    #ifdef USE_DEBUG
      if (texCoord.x > 0.5) return dofDebug(vTexCoord0, focusDistance, blur, focusScale);
    #endif

    vec3 color = texture2D(uTexture, texCoord).rgb;

    if (blur >= 0.05) {
      vec2 noise =
        (vec2(rand(texCoord.xy), rand(texCoord.xy * 2.0)) * vec2(2.0) - vec2(1.0)) *
        namount *
        blur;
      vec2 blurFactor = uTexelSize * blur * maxBlur + noise;

      float s = 1.0;
      int ringSamples;
      float ringFloat = float(RINGS);

      for (int i = 1; i <= RINGS; i++) {
        ringSamples = i * NUM_SAMPLES;
        float iFloat = float(i);

        for (int j = 0; j < MAX_RING_SAMPLES; j++) {
          if (j >= ringSamples) break;
          float jFloat = float(j);
          float step = TWO_PI / float(ringSamples);
          vec2 pwh = vec2(
            cos(jFloat * step) * iFloat,
            sin(jFloat * step) * iFloat
          );

          #ifdef USE_SHAPE_PENTAGON
            float p = pentagon(pwh, ringFloat);
          #else
            float p = 1.0;
          #endif

          float m = mix(1.0, iFloat / ringFloat, bias) * p;
          color += processSample(texCoord + pwh * blurFactor, blur, uTexelSize) * m;
          s += m;
        }
      }

      color /= s;
    }

    return color;
  }
#endif

void main () {
  #ifdef USE_FOCUS_ON_SCREEN_POINT
    float focusDistance = readDepth(uDepthTexture, uScreenPoint, uNear, uFar) * 1000.0; // m -> mm
  #else
    float focusDistance = uFocusDistance * 1000.0; // m -> mm
  #endif

  float centerDepth = readDepth(uDepthTexture, vTexCoord0, uNear, uFar) * 1000.0;

  #ifdef USE_PHYSICAL
    // Act as an fStop divider
    float focusScale = 1.0 / uFocusScale;
  #else
    // Heuristic for focus scale to be relative to height / 1024
    // TODO: should it aim to be close to camera physical default instead?
    float focusScale = (uFocusScale * uViewportSize.y) / 1024.0 * 1000.0; // mm
  #endif

  float centerSize = getCoC(centerDepth, focusDistance, focusScale); // mm

  #ifdef USE_DOF_GUSTAFSSON
    vec3 color = depthOfFieldGustafsson(vTexCoord0, focusDistance, centerSize, focusScale, centerDepth);
  #endif
  #ifdef USE_DOF_UPITIS
    vec3 color = depthOfFieldUpitis(vTexCoord0, focusDistance, centerSize, focusScale);
  #endif

  gl_FragColor = vec4(color, 1.0);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.threshold.frag
 * @type {string}
 */ var thresholdFrag = /* glsl */ `
precision highp float;

// Optional defines:
// COLOR_FUNCTION
// USE_SOURCE_COLOR
// USE_SOURCE_EMISSIVE

#ifndef COLOR_FUNCTION
  #define COLOR_FUNCTION luma
#endif

${frag}

#ifndef USE_SOURCE_EMISSIVE
  uniform sampler2D uTexture;
#endif
uniform sampler2D uEmissiveTexture;

uniform float uExposure;
uniform float uThreshold;

varying vec2 vTexCoord0;

// Includes
${luma_glsl}
${luminance_glsl}
${average_glsl}

void main() {
  // Glare naturally occurs for anything bright enough.
  #ifdef USE_SOURCE_EMISSIVE
    // For artistic control, perform threshold only on emissive.
    vec4 color = texture2D(uEmissiveTexture, vTexCoord0);
  #else
    // Or use color where, for a threshold value of 1, only HDR colors are filtered
    vec4 color = texture2D(uTexture, vTexCoord0);
  #endif

  color.rgb *= uExposure;

  float brightness = COLOR_FUNCTION(color.rgb);
  float smoothRange = 0.1;
  float t1 = uThreshold * (1.0 - smoothRange);

  if (brightness > t1) {
    color *= smoothstep(t1, uThreshold * (1.0 + smoothRange), brightness);
  } else {
    color = vec4(0.0);
  }

  // Emissive is added on top if not performing threshold on a specific source
  #if !defined(USE_SOURCE_COLOR) && !defined(USE_SOURCE_EMISSIVE)
    color += texture2D(uEmissiveTexture, vTexCoord0);
  #endif

  gl_FragColor = color;

  ${assignment}
}
`;

/**
 * Downsample
 *
 * Reference Implementation: https://github.com/keijiro/KinoBloom
 * @alias module:postProcessing.downsample.frag
 * @type {string}
 */ var downsampleFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;

uniform float uIntensity;

varying vec2 vTexCoord0;

varying vec2 vTexCoord0LeftUp;
varying vec2 vTexCoord0RightUp;
varying vec2 vTexCoord0LeftDown;
varying vec2 vTexCoord0RightDown;

float Brightness(vec3 c) {
  return max(max(c.r, c.g), c.b);
}

void main () {
  // Downsample with a 4x4 box filter
  #if QUALITY == 0
    gl_FragColor = (
      texture2D(uTexture, vTexCoord0LeftDown) +
      texture2D(uTexture, vTexCoord0RightDown) +
      texture2D(uTexture, vTexCoord0) +
      texture2D(uTexture, vTexCoord0LeftUp) +
      texture2D(uTexture, vTexCoord0RightUp)
    ) / 5.0 * uIntensity;

  // Downsample with a 4x4 box filter + anti-flicker filter
  #else
    vec4 s1 = texture2D(uTexture, vTexCoord0LeftDown);
    vec4 s2 = texture2D(uTexture, vTexCoord0RightDown);
    vec4 s3 = texture2D(uTexture, vTexCoord0LeftUp);
    vec4 s4 = texture2D(uTexture, vTexCoord0RightUp);

    // Karis's luma weighted average (using brightness instead of luma)
    float s1w = 1.0 / (Brightness(s1.xyz) + 1.0);
    float s2w = 1.0 / (Brightness(s2.xyz) + 1.0);
    float s3w = 1.0 / (Brightness(s3.xyz) + 1.0);
    float s4w = 1.0 / (Brightness(s4.xyz) + 1.0);
    float one_div_wsum = 1.0 / (s1w + s2w + s3w + s4w);

    gl_FragColor = (
      (s1 * s1w + s2 * s2w + s3 * s3w + s4 * s4w) * one_div_wsum
    ) * uIntensity;
  #endif

  ${assignment}
}
`;

/**
 * Upsample
 *
 * Reference Implementation: https://github.com/keijiro/KinoBloom
 * @alias module:postProcessing.upsample.frag
 * @type {string}
 */ var upsampleFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform vec2 uTexelSize;

varying vec2 vTexCoord0LeftUp;
varying vec2 vTexCoord0RightUp;
varying vec2 vTexCoord0LeftDown;
varying vec2 vTexCoord0RightDown;

#if QUALITY == 1
  varying vec2 vTexCoord0;
  varying vec2 vTexCoord0Down;
  varying vec2 vTexCoord0Up;
  varying vec2 vTexCoord0Left;
  varying vec2 vTexCoord0Right;
#endif

void main () {
  // 4-tap bilinear upsampler
  #if QUALITY == 0
    gl_FragColor = vec4(
      (
        texture2D(uTexture, vTexCoord0LeftDown).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0RightDown).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0LeftUp).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0RightUp).rgb * 0.25
      ),
      1.0
    );
  // 9-tap bilinear upsampler (tent filter)
  #else
    gl_FragColor = vec4(
      (
        texture2D(uTexture, vTexCoord0LeftDown).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Left).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0RightDown).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Down).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0).rgb * 0.25 +
        texture2D(uTexture, vTexCoord0Up).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0LeftUp).rgb * 0.0625 +
        texture2D(uTexture, vTexCoord0Right).rgb * 0.125 +
        texture2D(uTexture, vTexCoord0RightUp).rgb * 0.0625
      ),
      1.0
    );
  #endif

  ${assignment}
}
`;

/**
 * SSAO mix
 *
 * @alias module:postProcessing.ssaoMix.frag
 * @type {string}
 */ var ssaoMixFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uTexture;
uniform vec2 uViewportSize;

uniform sampler2D uSSAOTexture;
uniform float uSSAOMix;

${ambientOcclusion_glsl}

void main () {
  vec2 vUV = gl_FragCoord.xy / uViewportSize;

  gl_FragColor = ssao(texture2D(uTexture, vUV), texture2D(uSSAOTexture, vUV), uSSAOMix);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.combine.frag
 * @type {string}
 */ var combineFrag = /* glsl */ `precision highp float;

${frag}

// Variables
uniform sampler2D uTexture;
uniform sampler2D uDepthTexture;
uniform vec4 uViewport;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;
uniform float uTime;

// Camera
uniform mat4 uViewMatrix;
// TODO: group in vec4
uniform float uNear;
uniform float uFar;
uniform float uFov;
uniform float uExposure;

// Includes
${PI}
${saturate}
${encodeDecode_glsl}
${depthRead_glsl}
${Object.values(glslToneMap).join("\n")}

#ifdef USE_FOG
  uniform float uFogStart;
  uniform vec3 uSunPosition;

  ${depthPosition_glsl}
  ${fog_glsl}
#endif

#ifdef USE_SSAO
  uniform sampler2D uSSAOTexture;
  uniform float uSSAOMix;

  ${ambientOcclusion_glsl}
#endif

#ifdef USE_BLOOM
  uniform sampler2D uBloomTexture;
  uniform float uBloomIntensity;
#endif

#ifdef USE_LUT
  uniform sampler2D uLUTTexture;
  uniform float uLUTTextureSize;

  ${lut_glsl}
#endif

#ifdef USE_COLOR_CORRECTION
  // TODO: group in vec4
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uHue;

  ${colorCorrection_glsl}
#endif

#ifdef USE_VIGNETTE
  uniform float uVignetteRadius;
  uniform float uVignetteIntensity;

  ${vignette_glsl}
#endif

varying vec2 vTexCoord0;

void main() {
  vec4 color = vec4(0.0);

  vec2 uv = vTexCoord0;
  color = texture2D(uTexture, uv);

  // HDR effects
  #ifdef USE_FOG
    float z = readDepth(uDepthTexture, uv, uNear, uFar);
    vec3 pos = reconstructPositionFromDepth(uv, z);
    float rayLength = length(pos);
    vec3 rayDir = pos / rayLength;
    vec3 sunDir = normalize(vec3(uViewMatrix * vec4(normalize(uSunPosition), 0.0)));
    color.rgb = fog(color.rgb, rayLength - uFogStart, rayDir, sunDir);
  #endif

  #ifdef USE_SSAO
    color = ssao(color, texture2D(uSSAOTexture, uv), uSSAOMix);
  #endif

  #ifdef USE_BLOOM
    color.rgb += texture2D(uBloomTexture, uv).rgb * uBloomIntensity;
  #endif

  // Tonemapping and gamma conversion
  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
    color.rgb = saturate(color.rgb);
  #endif

  vec4 colorSRGB = encode(color, SRGB);

  // LDR effects
  #ifdef USE_VIGNETTE
    colorSRGB.rgb = vignette(colorSRGB.rgb, uv, uVignetteRadius, uVignetteIntensity);
  #endif

  #ifdef USE_LUT
    colorSRGB.rgb = lut(vec4(colorSRGB.rgb, 1.0), uLUTTexture, uLUTTextureSize).rgb;
  #endif

  #ifdef USE_COLOR_CORRECTION
    colorSRGB.rgb = brightnessContrast(colorSRGB.rgb, uBrightness, uContrast);
    colorSRGB.rgb = saturation(colorSRGB.rgb, uSaturation);
    colorSRGB.rgb = hue(colorSRGB.rgb, uHue / 180.0 * PI);
  #endif

  gl_FragColor = decode(colorSRGB, SRGB);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.luma.frag
 * @type {string}
 */ var lumaFrag = /* glsl */ `precision highp float;

${frag}

// Variables
uniform sampler2D uTexture;

// Includes
${luma_glsl}
${encodeDecode_glsl}

varying vec2 vTexCoord0;

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);

  gl_FragData[0].r = luma(encode(color, SRGB).rgb);

  ${assignment}
}
`;

/**
 * @alias module:postProcessing.final.frag
 * @type {string}
 */ var finalFrag = /* glsl */ `precision highp float;

${frag}

// Variables
uniform sampler2D uTexture;
uniform vec2 uViewportSize;
uniform vec2 uTexelSize;
uniform float uTime;

// Includes
${saturate}
${encodeDecode_glsl}

#if defined(USE_FXAA) || defined(USE_FILM_GRAIN)
  uniform sampler2D uLumaTexture;

  float readLumaTexture(sampler2D tex, vec2 uv) {
    return texture2D(tex, uv).r;
  }
#endif

#ifdef USE_FXAA
  // FXAA blends anything that has high enough contrast. It helps mitigate fireflies but will blur small details.
  // - 1.00: upper limit (softer)
  // - 0.75: default amount of filtering
  // - 0.50: lower limit (sharper, less sub-pixel aliasing removal)
  // - 0.25: almost off
  // - 0.00: completely off
  uniform float uSubPixelQuality;
  ${fxaa_glsl}
#endif

#ifdef USE_FILM_GRAIN
  uniform float uFilmGrainSize;
  uniform float uFilmGrainIntensity;
  uniform float uFilmGrainColorIntensity;
  uniform float uFilmGrainLuminanceIntensity;
  uniform float uFilmGrainSpeed;

  ${common}
  ${simplex}
  ${perlin}
  ${random}
  ${filmGrain_glsl}
#endif

uniform float uOpacity;

varying vec2 vTexCoord0;

#ifdef USE_FXAA
  varying vec2 vTexCoord0LeftUp;
  varying vec2 vTexCoord0RightUp;
  varying vec2 vTexCoord0LeftDown;
  varying vec2 vTexCoord0RightDown;
  varying vec2 vTexCoord0Down;
  varying vec2 vTexCoord0Up;
  varying vec2 vTexCoord0Left;
  varying vec2 vTexCoord0Right;
#endif

void main() {
  vec2 uv;

  #ifdef USE_FXAA
    uv = fxaa(
      uLumaTexture,
      vTexCoord0,
      vTexCoord0LeftUp,
      vTexCoord0RightUp,
      vTexCoord0LeftDown,
      vTexCoord0RightDown,
      vTexCoord0Down,
      vTexCoord0Up,
      vTexCoord0Left,
      vTexCoord0Right,
      uTexelSize,
      uSubPixelQuality
    );
  #else
    uv = vTexCoord0;
  #endif

  vec4 color = texture2D(uTexture, uv);

  vec4 colorSRGB = encode(color, SRGB);

  #ifdef USE_FILM_GRAIN
    colorSRGB.rgb = filmGrain(
      colorSRGB.rgb,
      readLumaTexture(uLumaTexture, vTexCoord0),
      uv,
      uViewportSize,
      uFilmGrainSize,
      uFilmGrainIntensity,
      uFilmGrainColorIntensity,
      uFilmGrainLuminanceIntensity,
      floor(uTime * uFilmGrainSpeed * 60.0)
    );
  #endif

  gl_FragColor = decode(colorSRGB, SRGB);
  gl_FragColor.a *= uOpacity;

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const postProcessing = {
    vert: postProcessingVert
};
/**
 * @member {object}
 * @static
 */ const gtao = {
    frag: gtaoFrag
};
/**
 * @member {object}
 * @static
 */ const sao = {
    frag: saoFrag
};
/**
 * @member {object}
 * @static
 */ const bilateralBlur = {
    frag: bilateralBlurFrag
};
/**
 * @member {object}
 * @static
 */ const dof = {
    frag: dofFrag
};
/**
 * @member {object}
 * @static
 */ const threshold = {
    frag: thresholdFrag
};
/**
 * @member {object}
 * @static
 */ const downsample = {
    frag: downsampleFrag
};
/**
 * @member {object}
 * @static
 */ const upsample = {
    frag: upsampleFrag
};
/**
 * @member {object}
 * @static
 */ const ssaoMix = {
    frag: ssaoMixFrag
};
/**
 * @member {object}
 * @static
 */ const combine = {
    frag: combineFrag
};
/**
 * @member {object}
 * @static
 */ const luma = {
    frag: lumaFrag
};
/**
 * @member {object}
 * @static
 */ const final = {
    frag: finalFrag
};

var index$3 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  bilateralBlur: bilateralBlur,
  combine: combine,
  dof: dof,
  downsample: downsample,
  final: final,
  gtao: gtao,
  luma: luma,
  postProcessing: postProcessing,
  sao: sao,
  ssaoMix: ssaoMix,
  threshold: threshold,
  upsample: upsample
});

/**
 * @alias module:reflectionProbe.blitToOctMapAtlas.frag
 * @type {string}
 */ var blitToOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uOctMap;
uniform float uOctMapSize;
uniform float uSourceRegionSize;

varying vec2 vTexCoord0;

void main() {
  vec2 uv = vTexCoord0;
  uv *= uSourceRegionSize / uOctMapSize;

  gl_FragColor = texture2D(uOctMap, uv);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.convolveOctMapAtlasToOctMap.frag
 * @type {string}
 */ var convolveOctMapAtlasToOctMapFrag = /* glsl */ `
precision highp float;

${frag}

uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform float uIrradianceOctMapSize;

varying vec2 vTexCoord0;

${PI}
${octMapUvToDir_glsl}
${octMap_glsl}
${encodeDecode_glsl}

void main() {
  vec3 N = octMapUVToDir(vTexCoord0, uIrradianceOctMapSize);
  vec3 normal = N;

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = cross(normal,right);

  vec3 sampledColor = vec3(0.0, 0.0, 0.0);
  float index = 0.0;
  const float dphi = 2.0 * PI / 180.0 * 2.0;
  const float dtheta = 0.5 * PI / 64.0 * 2.0;
  for(float phi = 0.0; phi < 2.0 * PI; phi += dphi) {
    for(float theta = 0.0; theta < 0.5 * PI; theta += dtheta) {
      vec3 temp = cos(phi) * right + sin(phi) * up;
      vec3 sampleVector = cos(theta) * normal + sin(theta) * temp;
      // in theory this should be sample from mipmap level e.g. 2.0, 0.0
      // but sampling from prefiltered roughness gives much smoother results
      vec2 sampleUV = envMapOctahedral(sampleVector, 0.0, 2.0, uOctMapAtlasSize);
      vec4 color = texture2D(uOctMapAtlas, sampleUV);
      sampledColor += color.rgb * cos(theta) * sin(theta);
      index += 1.0;
    }
  }

  sampledColor = PI * sampledColor / index;
  gl_FragColor = vec4(sampledColor, 1.0);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.cubemapToOctMap.frag
 * @type {string}
 */ var cubemapToOctmapFrag = /* glsl */ `
precision highp float;

${frag}

${octMapUvToDir_glsl}

uniform samplerCube uCubemap;
uniform float uTextureSize;

varying vec2 vTexCoord0;

void main() {
  vec3 N = octMapUVToDir(vTexCoord0, uTextureSize);
  gl_FragColor = textureCube(uCubemap, N);

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.downsampleFromOctMapAtlas.frag
 * @type {string}
 */ var downsampleFromOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

// uniform float uLevelSize;
uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform float uRoughnessLevel;
uniform float uMipmapLevel;

varying vec2 vTexCoord0;

${octMapUvToDir_glsl}
${octMap_glsl}

void main() {
  vec2 uv = vTexCoord0;
  float width = uOctMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size

  float levelSize = width / pow(2.0, 1.0 + uMipmapLevel + uRoughnessLevel);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + uRoughnessLevel);

  float vOffset = (width - pow(2.0, maxLevel - uRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - uMipmapLevel);
  // trying to fix oveflow from atlas..
  uv = (uv * levelSize - 0.5) / (levelSize - 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  vec4 color = vec4(0.0);
  color += texture2D(uOctMapAtlas, uv);
  color += texture2D(uOctMapAtlas, uv + vec2(-1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0,-1.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0, 1.0)/levelSize);
  color /= 5.0;
  gl_FragColor = color;

  ${assignment}
}
`;

/**
 * @alias module:reflectionProbe.prefilterFromOctMapAtlas.frag
 * @type {string}
 */ var prefilterFromOctMapAtlasFrag = /* glsl */ `
precision highp float;

${frag}

// Variables
uniform float uTextureSize;
uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform sampler2D uHammersleyPointSetMap;
uniform int uNumSamples;
uniform float uLevel;
uniform float uSourceMipmapLevel;
uniform float uSourceRoughnessLevel;
uniform float uRoughnessLevel;

varying vec2 vTexCoord0;

// Includes
${PI}
${saturate}
${octMap_glsl}
${octMapUvToDir_glsl}
${encodeDecode_glsl}

//Sampled from a texture generated by code based on
//http://holger.dammertz.org/stuff/notes_HammersleyOnHemisphere.html
vec2 Hammersley(int i, int N) {
  return texture2D(uHammersleyPointSetMap, vec2(0.5, (float(i) + 0.5)/float(N))).rg;
}

//Based on Real Shading in Unreal Engine 4
vec3 ImportanceSampleGGX(vec2 Xi, float Roughness, vec3 N) {
  //this is mapping 2d point to a hemisphere but additionally we add spread by roughness
  float a = Roughness * Roughness;
  // a *= 0.75; // to prevent overblurring as we sample from previous roughness level with smaller number of samples
  float Phi = 2.0 * PI * Xi.x;
  float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
  float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
  vec3 H;
  H.x = SinTheta * cos(Phi);
  H.y = SinTheta * sin(Phi);
  H.z = CosTheta;

  //Tangent space vectors
  vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent = normalize(cross(up, N));
  vec3 bitangent = normalize(cross(N, tangent));

  //Tangent to World Space
  vec3 sampleVec = tangent * H.x + bitangent * H.y + N * H.z;
  return normalize(sampleVec);
}

//TODO: optimize this using sign()
//Source: http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 textureOctMapLod(sampler2D tex, vec2 uv, float sourceRoughnessLevel, float sourceMipmapLevel) {
  float width = uOctMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size

  float levelSize = width / pow(2.0, 1.0 + sourceMipmapLevel + sourceRoughnessLevel);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + sourceMipmapLevel);

  float vOffset = (width - pow(2.0, maxLevel - sourceRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - sourceMipmapLevel);

  // trying to fix oveflow from atlas..
  uv = (uv * levelSize + 0.5) / (levelSize + 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  return texture2D(uOctMapAtlas, uv);
}

vec4 textureOctMapLod(sampler2D tex, vec2 uv) {
  return textureOctMapLod(tex, uv, uSourceRoughnessLevel, uSourceMipmapLevel);
}

vec3 PrefilterEnvMap( float roughness, vec3 R, vec2 uv ) {
  vec3 N = R;
  vec3 V = R;
  vec3 PrefilteredColor = vec3(0.0);
  const int NumSamples = 1024;
  float TotalWeight = 0.0;
  for( int i = 0; i < NumSamples; i++ ) {
    if (i >= uNumSamples) {
      break;
    }
    vec2 Xi = Hammersley( i, uNumSamples );
    //vec3 H = ImportanceSampleGGX( Xi, roughness, normalize(N + 0.02* vec3(rand(uv), rand(uv.yx), rand(uv * 2.0))));
    vec3 H = ImportanceSampleGGX( Xi, roughness, N);
    vec3 L = normalize(2.0 * dot( V, H ) * H - V);
    float NoL = saturate( dot( N, L ) );
    if( NoL > 0.0 ) {
      vec4 color = textureOctMapLod(uOctMapAtlas, envMapOctahedral(L));
      PrefilteredColor += NoL * color.rgb;
      TotalWeight += NoL;
    }
  }
  return PrefilteredColor / TotalWeight;
}

void main() {
  vec3 normal = octMapUVToDir(vTexCoord0);
  vec3 color = PrefilterEnvMap(uRoughnessLevel / 5.0, normal, vTexCoord0);
  gl_FragColor = vec4(color, 1.0);

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const blitToOctMapAtlas = {
    frag: blitToOctMapAtlasFrag
};
/**
 * @member {object}
 * @static
 */ const convolveOctMapAtlasToOctMap = {
    frag: convolveOctMapAtlasToOctMapFrag
};
/**
 * @member {object}
 * @static
 */ const cubemapToOctMap = {
    frag: cubemapToOctmapFrag
};
/**
 * @member {object}
 * @static
 */ const downsampleFromOctMapAtlas = {
    frag: downsampleFromOctMapAtlasFrag
};
/**
 * @member {object}
 * @static
 */ const prefilterFromOctMapAtlas = {
    frag: prefilterFromOctMapAtlasFrag
};

var index$2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  blitToOctMapAtlas: blitToOctMapAtlas,
  convolveOctMapAtlasToOctMap: convolveOctMapAtlasToOctMap,
  cubemapToOctMap: cubemapToOctMap,
  downsampleFromOctMapAtlas: downsampleFromOctMapAtlas,
  prefilterFromOctMapAtlas: prefilterFromOctMapAtlas
});

/**
 * Skybox
 *
 * Based on http://gamedev.stackexchange.com/questions/60313/implementing-a-skybox-with-glsl-version-330
 * @alias module:skybox.skybox.vert
 * @type {string}
 */ var skyboxVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

${inverseMat4}
${transposeMat3}

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

varying vec3 wcNormal;

void main() {
  mat4 inverseProjection = inverse(uProjectionMatrix);
  mat3 inverseModelview = transpose(mat3(uViewMatrix));
  vec3 unprojected = (inverseProjection * vec4(aPosition, 0.0, 1.0)).xyz;
  wcNormal = (uModelMatrix * vec4(inverseModelview * unprojected, 1.0)).xyz;

  gl_Position = vec4(aPosition, 0.9999, 1.0);
}
`;

/**
 * @alias module:skybox.skybox.frag
 * @type {string}
 */ var skyboxFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

// Variables
uniform sampler2D uEnvMap; // Linear (eg. HDR in RGBA32F or sky in SRGB8_ALPHA8)
uniform float uEnvMapSize;
uniform float uEnvMapExposure;
uniform float uBackgroundBlur;

varying vec3 wcNormal;

// Includes
${PI}
${TWO_PI}

${encodeDecode_glsl}
${envMapEquirect_glsl}
${octMap_glsl}
${irradiance_glsl}
${max3}
${reversibleToneMap_glsl}

void main() {
  vec3 N = normalize(wcNormal);

  vec4 color = vec4(0.0);

  if (uBackgroundBlur <= 0.0) {
    color = texture2D(uEnvMap, envMapEquirect(N));
  } else {
    color = vec4(getIrradiance(N, uEnvMap, uEnvMapSize, LINEAR), 1.0);
  }

  color.rgb *= uEnvMapExposure;

  #ifdef USE_MSAA
    color.rgb = reversibleToneMap(color.rgb);
  #endif

  gl_FragData[0] = color;

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
  #endif

  ${assignment}
}
`;

/**
 * @alias module:skybox.skyEnvMap.vert
 * @type {string}
 */ var skyEnvMapVert = /* glsl */ `
${vert}

attribute vec2 aPosition;

uniform vec3 uSunPosition;
uniform vec4 uParameters; // turbidity, rayleigh, mieCoefficient, mieDirectionalG

varying vec2 vTexCoord0;

varying vec3 vSunDirection;
varying float vSunfade;
varying float vSunE;
varying vec3 vBetaR;
varying vec3 vBetaM;

${saturate}

// const float turbidity = 10.0; // a measure of the fraction of scattering due to haze as opposed to molecules.
// const float rayleigh = 2.0; // scattering by air molecules
// const float mieCoefficient = 0.005; // non-molecular scattering or aerosol particle scattering

// constants for atmospheric scattering
const float e = 2.71828182845904523536028747135266249775724709369995957;

// const float n = 1.0003; // refractive index of air
// const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)
// const float pn = 0.035; // depolatization factor for standard air

// wavelength of used primaries, according to preetham
const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);

// mie stuff
// K coefficient for the primaries
const vec3 K = vec3(0.686, 0.678, 0.666);
const float v = 4.0;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float EE = 1000.0;
// 66 arc seconds -> degrees, and the cosine of that

// earth shadow hack
const float cutoffAngle = 1.6110731556870734; // pi/1.95;
const float steepness = 1.5;

const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);

// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);

// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE
// const vec3 simplifiedRayleigh = 0.0005 / vec3(94, 40, 18);

// float sunIntensity(float zenithAngleCos) {
//   return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos)) / steepness)));
// }
float sunIntensity(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}

vec3 totalMie(float T) {
  float c = (0.2 * T) * 10E-18;
  return 0.434 * c * MieConst;
}

void main() {
  vSunDirection = normalize(uSunPosition);
  vSunfade = 1.0 - saturate(1.0 - exp((uSunPosition.y / 450000.0)));
  vSunE = sunIntensity(dot(vSunDirection, up));

  float rayleighCoefficient = uParameters.y - (1.0 * (1.0 - vSunfade));
  // extinction (absorbtion + out scattering)
  // rayleigh coefficients
  vBetaR = totalRayleigh * rayleighCoefficient;
  // vBetaR = simplifiedRayleigh * rayleighCoefficient;

  // mie coefficients
  vBetaM = totalMie(uParameters.x) * uParameters.z;
  // vec3 betaM = totalMie(turbidity) * mieCoefficient;

  gl_Position = vec4(aPosition, 0.0, 1.0);
  vTexCoord0 = aPosition * 0.5 + 0.5;
}
`;

/**
 * Sky
 *
 * Based on "A Practical Analytic Model for Daylight" aka The Preetham Model, the de facto standard analytic skydome model
 *
 * Paper: https://www.researchgate.net/publication/220720443_A_Practical_Analytic_Model_for_Daylight
 *
 * Reference Implementation:
 * - First implemented by Simon Wallner http://www.simonwallner.at/projects/atmospheric-scattering
 * - Improved by Martins Upitis http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 * - Three.js integration by zz85 http://twitter.com/blurspline
 *
 * Updates: Marcin Ignac http://twitter.com/marcinignac (2015-09) and Damien Seguin (2023-10)
 * @alias module:skybox.skyEnvMap.frag
 * @type {string}
 */ var skyEnvMapFrag = /* glsl */ `
#if (__VERSION__ < 300)
  #ifdef USE_DRAW_BUFFERS
    #extension GL_EXT_draw_buffers : enable
  #endif
#endif

precision highp float;

${frag}

uniform vec4 uParameters; // turbidity, rayleigh, mieCoefficient, mieDirectionalG

varying vec3 vSunDirection;
varying float vSunfade;
varying float vSunE;
varying vec3 vBetaR;
varying vec3 vBetaM;

varying vec2 vTexCoord0;

${PI}
${TWO_PI}
${saturate}
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}
#ifndef TONE_MAP
  #define TONE_MAP aces
#endif

// const float mieDirectionalG = 0.8;

// const float pi = 3.141592653589793238462643383279502884197169;

// optical length at zenith for molecules
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;

const vec3 up = vec3(0.0, 1.0, 0.0);

const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

// 3.0 / (16.0 * pi)
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;

float rayleighPhase(float cosTheta) {
  return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
}

// 1.0 / (4.0 * pi)
const float ONE_OVER_FOURPI = 0.07957747154594767;

float hgPhase(float cosTheta, float g) {
  float g2 = pow(g, 2.0);
  return ONE_OVER_FOURPI * ((1.0 - g2) / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5));
}

vec3 sky(vec3 worldNormal) {
  vec3 direction = normalize(worldNormal); // vWorldPosition - cameraPos

  // optical length
  // cutoff angle at 90 to avoid singularity in next formula.
  float zenithAngle = acos(max(0.0, dot(up, direction)));
  float divider = (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253));
  float sR = rayleighZenithLength / divider;
  float sM = mieZenithLength / divider;

  // combined extinction factor
  vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));

  // in scattering
  float cosTheta = dot(direction, vSunDirection);

  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
  vec3 betaRTheta = vBetaR * rPhase;

  float mPhase = hgPhase(cosTheta, uParameters.w);
  // float mPhase = hgPhase(cosTheta, mieDirectionalG);
  vec3 betaMTheta = vBetaM * mPhase;

  vec3 LinFactor = vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM));
  vec3 Lin = pow(LinFactor * (1.0 - Fex), vec3(1.5));
  Lin *= mix(
    vec3(1.0),
    pow(LinFactor * Fex, vec3(1.0 / 2.0)),
    saturate(pow(1.0 - dot(up, vSunDirection), 5.0))
  );

  // nightsky
  float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]
  float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]
  vec2 uv = vec2(phi, theta) / vec2(TWO_PI, PI) + vec2(0.5, 0.0);
  // vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;
  vec3 L0 = vec3(0.1) * Fex;

  // composition + solar disc
  // if (cosTheta > sunAngularDiameterCos)
  float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
  // if (normalize(vWorldPosition - cameraPos).y>0.0)
  L0 += (vSunE * 19000.0 * Fex) * sundisk;

  vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);

  return pow(texColor, vec3(1.0 / (1.2 + (1.2 * vSunfade))));
}

void main() {
  vec4 color = vec4(0.0);

  // Texture coordinates to normal:
  // https://web.archive.org/web/20170606085139/http://gl.ict.usc.edu/Data/HighResProbes/
  // u=[0,2], v=[0,1],
  // theta=pi*(u-1), phi=pi*v
  // (Dx,Dy,Dz) = (sin(phi)*sin(theta), cos(phi), -sin(phi)*cos(theta)).

  float theta = PI * (vTexCoord0.x * 2.0 - 1.0);
  float phi = PI * (1.0 - vTexCoord0.y);

  color.rgb = sky(vec3(sin(phi) * sin(theta), cos(phi), -sin(phi) * cos(theta)));
  color.rgb = TONE_MAP(color.rgb);
  color.rgb = toLinear(color.rgb);

  color.a = 1.0;

  gl_FragData[0] = color;

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(0.0, 0.0, 1.0, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = vec4(0.0);
    #endif
    #if LOCATION_VELOCITY >= 0
      gl_FragData[LOCATION_VELOCITY] = vec4(0.5, 0.5, 0.5, 1.0);
    #endif
  #endif

  ${assignment}
}
`;

/**
 * @member {object}
 * @static
 */ const skybox = {
    vert: skyboxVert,
    frag: skyboxFrag
};
/**
 * @member {object}
 * @static
 */ const skyEnvMap = {
    vert: skyEnvMapVert,
    frag: skyEnvMapFrag
};

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  skyEnvMap: skyEnvMap,
  skybox: skybox
});

/** @module parser */ /**
 * GLSL 3 preprocessor version string
 */ const GLSL3 = "#version 300 es";
/**
 * Format an object of extension names as key and extension behaviosr (enable/require/warn/disable) as value
 * @param {object} [extensions={}]
 * @returns {string}
 */ function formatExtensions(extensions = {}) {
    return Object.entries(extensions).map(([name, behavior])=>`#extension ${name} : ${behavior}`).join("\n");
}
/**
 * Format an array of define keys
 * @param {string[]} [defines=[]]
 * @returns {string}
 */ function formatDefines(defines = []) {
    return defines.map((flag)=>`#define ${flag}`).join("\n");
}
/**
 * Add version string and format a list of defines for a shader source
 * @param {ctx} ctx
 * @param {string} src
 * @param {string[]} [defines=[]]
 * @param {object} [extensions={}]
 * @returns {string}
 */ function build(ctx, src, defines = [], extensions = {}) {
    return `${ctx.capabilities.isWebGL2 ? GLSL3 : ""}
${formatExtensions(extensions)}
${formatDefines(defines)}
${src}`;
}
/**
 * Monkey patch a shader string for ES300 by replacing builtin keywords and un-necessary extensions, and adding the version preprocessor string
 * @param {string} src
 * @param {"vertex" | "fragment"} stage
 * @returns {string}
 */ function patchES300(src, stage = "vertex") {
    src = src.replace(/texture2D/g, "texture").replace(/textureCube/g, "texture").replace(/texture2DProj/g, "textureProj").replace("mat4 transpose(mat4 m) {", "mat4 transposeOld(mat4 m) {").replace("mat3 transpose(mat3 m) {", "mat3 transposeOld(mat3 m) {").replace("mat4 inverse(mat4 m) {", "mat4 inverseOld(mat4 m) {");
    if (stage === "vertex") {
        if (src.startsWith("#version")) src = src.split("\n").slice(1).join("\n");
        src = src.replace(/attribute/g, "in").replace(/varying/g, "out");
    } else if (stage === "fragment") {
        src = src.split("\n").map((line)=>{
            const trimmedLine = line.trim();
            if ([
                "#version",
                "#extension GL_OES_standard_derivatives",
                "#extension GL_EXT_shader_texture_lod",
                "#extension GL_EXT_draw_buffers",
                "#extension GL_EXT_frag_depth"
            ].some((extension)=>trimmedLine.startsWith(extension))) {
                return false;
            }
            return trimmedLine.startsWith("precision ") ? trimmedLine.replace(/;/, `;\nlayout (location = 0) out vec4 outColor;
layout (location = 1) out vec4 outNormal;
layout (location = 2) out vec4 outEmissive;`) : line;
        }).map((line)=>line || "").join("\n").replace(/varying/g, "in").replace(/texture2DLodEXT/g, "textureLod").replace(/texture2DProjLodEXT/g, "textureProjLod").replace(/textureCubeLodEXT/g, "textureLod").replace(/texture2DGradEXT/g, "textureGrad").replace(/texture2DProjGradEXT/g, "textureProjGrad").replace(/textureCubeGradEXT/g, "textureGrad").replace(/gl_FragData\[0\]/g, "outColor").replace(/gl_FragColor/g, "outColor").replace(/gl_FragData\[1\]/g, "outNormal").replace(/gl_FragData\[2\]/g, "outEmissive");
    }
    return `${GLSL3}\n${src}`;
}
/**
 * Unroll loops (looped preceded by "#pragma unroll_loop") for lights and replace their constant iterators
 * @param {string} src
 * @param {object} options
 * @returns {string}
 */ function replaceStrings(src, options) {
    // Unroll loop
    const unrollLoopPattern = /#pragma unroll_loop[\s]+?for \(int i = (\d+); i < (\d+|\D+); i\+\+\) \{([\s\S]+?)(?=\})\}/g;
    src = src.replace(unrollLoopPattern, (match, start, end, snippet)=>{
        let unroll = "";
        // Replace lights number
        end = end.replace(/NUM_AMBIENT_LIGHTS/g, options.ambientLights.length || 0).replace(/NUM_DIRECTIONAL_LIGHTS/g, options.directionalLights.length || 0).replace(/NUM_POINT_LIGHTS/g, options.pointLights.length || 0).replace(/NUM_SPOT_LIGHTS/g, options.spotLights.length || 0).replace(/NUM_AREA_LIGHTS/g, options.areaLights.length || 0);
        for(let i = Number.parseInt(start); i < Number.parseInt(end); i++){
            unroll += snippet.replace(/\[i\]/g, `[${i}]`);
        }
        return unroll;
    });
    return src;
}
/**
 * Get a formatted error pointing at the issue line
 * @param {Error} error
 * @param {{ vert: string, frag: string, count: number }} options
 * @returns {string}
 */ function getFormattedError(error, { vert, frag, count = 5 }) {
    const lines = (error.message.match(/Vertex/) ? vert : frag).split("\n");
    const lineNo = parseInt(error.message.match(/ERROR: ([\d]+):([\d]+)/)[2]);
    const startIndex = Math.max(lineNo - count, 0);
    return lines.slice(startIndex, Math.min(lineNo + count, lines.length - 1)).map((line, i)=>startIndex + i == lineNo - 1 ? `--> ${line}` : `    ${line}`).join("\n");
}

var parser = /*#__PURE__*/Object.freeze({
  __proto__: null,
  GLSL3: GLSL3,
  build: build,
  formatDefines: formatDefines,
  formatExtensions: formatExtensions,
  getFormattedError: getFormattedError,
  patchES300: patchES300,
  replaceStrings: replaceStrings
});

var presets_glsl = /* glsl */ `// Presets
#if defined(SMAA_PRESET_LOW)
#define SMAA_THRESHOLD 0.15
#define SMAA_MAX_SEARCH_STEPS 4
#define SMAA_DISABLE_DIAG_DETECTION
#define SMAA_DISABLE_CORNER_DETECTION
#elif defined(SMAA_PRESET_MEDIUM)
#define SMAA_THRESHOLD 0.1
#define SMAA_MAX_SEARCH_STEPS 8
#define SMAA_DISABLE_DIAG_DETECTION
#define SMAA_DISABLE_CORNER_DETECTION
#elif defined(SMAA_PRESET_HIGH)
#define SMAA_THRESHOLD 0.1
#define SMAA_MAX_SEARCH_STEPS 16
#define SMAA_MAX_SEARCH_STEPS_DIAG 8
#define SMAA_CORNER_ROUNDING 25
#elif defined(SMAA_PRESET_ULTRA)
#define SMAA_THRESHOLD 0.05
#define SMAA_MAX_SEARCH_STEPS 32
#define SMAA_MAX_SEARCH_STEPS_DIAG 16
#define SMAA_CORNER_ROUNDING 25
#endif
`;

var smaaEdges_vert = /* glsl */ `
#define mad(a, b, c) (a * b + c)

attribute vec2 aPosition;

uniform vec2 uTexelSize;

varying vec2 vTexCoord0;
varying vec4 vOffset[3];

void main() {
	vTexCoord0 = vec2((aPosition + 1.0) / 2.0);

  vOffset[0] = mad(vec4(uTexelSize, uTexelSize), vec4(-1.0, 0.0, 0.0, -1.0), vTexCoord0.xyxy);
  vOffset[1] = mad(vec4(uTexelSize, uTexelSize), vec4( 1.0, 0.0, 0.0,  1.0), vTexCoord0.xyxy);
  vOffset[2] = mad(vec4(uTexelSize, uTexelSize), vec4(-2.0, 0.0, 0.0, -2.0), vTexCoord0.xyxy);

  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

var smaaEdges_frag = /* glsl */ `precision highp float;

#ifndef SMAA_THRESHOLD
  #define SMAA_THRESHOLD 0.1
#endif

#ifndef SMAA_PREDICATION
  #define SMAA_PREDICATION 0
#endif

/**
 * Threshold to be used in the additional predication buffer.
 *
 * Range: depends on the input, so you'll have to find the magic number that
 * works for you.
 */
#ifndef SMAA_PREDICATION_THRESHOLD
  #define SMAA_PREDICATION_THRESHOLD 0.01
#endif

/**
 * How much to scale the global threshold used for luma or color edge
 * detection when using predication.
 *
 * Range: [1, 5]
 */
#ifndef SMAA_PREDICATION_SCALE
  #define SMAA_PREDICATION_SCALE 2.0
#endif

/**
 * How much to locally decrease the threshold.
 *
 * Range: [0, 1]
 */
#ifndef SMAA_PREDICATION_STRENGTH
  #define SMAA_PREDICATION_STRENGTH 0.4
#endif

#if defined(SMAA_EDGES_DEPTH) || SMAA_PREDICATION
  uniform sampler2D uDepthTexture;
#endif

#ifdef SMAA_EDGES_DEPTH
  #ifndef SMAA_DEPTH_THRESHOLD
    #define SMAA_DEPTH_THRESHOLD (0.1 * SMAA_THRESHOLD)
  #endif

#else
  #ifndef SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR
    #define SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR 2.0
  #endif

  uniform sampler2D uColorTexture;
#endif

varying vec2 vTexCoord0;
varying vec4 vOffset[3];

#if defined(SMAA_EDGES_DEPTH) || SMAA_PREDICATION
  /**
  * Gathers current pixel, and the top-left neighbors.
  */
  vec3 SMAAGatherNeighbours(vec2 texcoord, vec4 offset[3], sampler2D tex) {
    float P = texture2D(tex, texcoord).r;
    float Pleft = texture2D(tex, offset[0].xy).r;
    float Ptop  = texture2D(tex, offset[0].zw).r;

    return vec3(P, Pleft, Ptop);
  }
#endif

#if SMAA_PREDICATION
  vec2 SMAACalculatePredicatedThreshold(vec2 texcoord, vec4 offset[3], sampler2D predicationTex) {
    vec3 neighbours = SMAAGatherNeighbours(texcoord, offset, predicationTex);
    vec2 delta = abs(neighbours.xx - neighbours.yz);
    vec2 edges = step(SMAA_PREDICATION_THRESHOLD, delta);
    return SMAA_PREDICATION_SCALE * SMAA_THRESHOLD * (1.0 - SMAA_PREDICATION_STRENGTH * edges);
  }
#endif

#ifdef SMAA_EDGES_DEPTH
  vec2 SMAADepthEdgeDetection(vec2 texcoord, vec4 offset[3], sampler2D depthTex) {
    vec3 neighbours = SMAAGatherNeighbours(texcoord, offset, depthTex);
    vec2 delta = abs(neighbours.xx - vec2(neighbours.y, neighbours.z));
    vec2 edges = step(SMAA_DEPTH_THRESHOLD, delta);

    if (dot(edges, vec2(1.0, 1.0)) == 0.0)
        discard;

    return edges;
  }
#endif

#ifdef SMAA_EDGES_LUMA
  vec2 SMAALumaEdgeDetection(vec2 texcoord, vec4 offset[3], sampler2D colorTex
  #if SMAA_PREDICATION
  , sampler2D predicationTex
  #endif
  ) {
    #if SMAA_PREDICATION
    vec2 threshold = SMAACalculatePredicatedThreshold(texcoord, offset, predicationTex);
    #else
    vec2 threshold = vec2(SMAA_THRESHOLD);
    #endif

    // Calculate lumas:
    vec3 weights = vec3(0.2126, 0.7152, 0.0722);
    float L = dot(texture2D(colorTex, texcoord).rgb, weights);

    float Lleft = dot(texture2D(colorTex, offset[0].xy).rgb, weights);
    float Ltop  = dot(texture2D(colorTex, offset[0].zw).rgb, weights);

    // We do the usual threshold:
    vec4 delta;
    delta.xy = abs(L - vec2(Lleft, Ltop));
    vec2 edges = step(threshold, delta.xy);

    // Then discard if there is no edge:
    if (dot(edges, vec2(1.0, 1.0)) == 0.0)
        discard;

    // Calculate right and bottom deltas:
    float Lright = dot(texture2D(colorTex, offset[1].xy).rgb, weights);
    float Lbottom  = dot(texture2D(colorTex, offset[1].zw).rgb, weights);
    delta.zw = abs(L - vec2(Lright, Lbottom));

    // Calculate the maximum delta in the direct neighborhood:
    vec2 maxDelta = max(delta.xy, delta.zw);

    // Calculate left-left and top-top deltas:
    float Lleftleft = dot(texture2D(colorTex, offset[2].xy).rgb, weights);
    float Ltoptop = dot(texture2D(colorTex, offset[2].zw).rgb, weights);
    delta.zw = abs(vec2(Lleft, Ltop) - vec2(Lleftleft, Ltoptop));

    // Calculate the final maximum delta:
    maxDelta = max(maxDelta.xy, delta.zw);
    float finalDelta = max(maxDelta.x, maxDelta.y);

    // Local contrast adaptation:
    edges.xy *= step(finalDelta, SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR * delta.xy);

    return edges;
  }
#endif

#ifdef SMAA_EDGES_COLOR
  vec2 SMAAColorEdgeDetection(vec2 texcoord, vec4 offset[3], sampler2D colorTex
  #if SMAA_PREDICATION
  , sampler2D predicationTex
  #endif
  ) {
    // Calculate the threshold:
    #if SMAA_PREDICATION
    vec2 threshold = SMAACalculatePredicatedThreshold(texcoord, offset, predicationTex);
    #else
    vec2 threshold = vec2(SMAA_THRESHOLD);
    #endif

    // Calculate color deltas:
    vec4 delta;
    vec3 c = texture2D(colorTex, texcoord).rgb;

    vec3 cLeft = texture2D(colorTex, offset[0].xy).rgb;
    vec3 t = abs(c - cLeft);
    delta.x = max(max(t.r, t.g), t.b);

    vec3 cTop  = texture2D(colorTex, offset[0].zw).rgb;
    t = abs(c - cTop);
    delta.y = max(max(t.r, t.g), t.b);

    // We do the usual threshold:
    vec2 edges = step(threshold, delta.xy);

    // Then discard if there is no edge:
    if (dot(edges, vec2(1.0, 1.0)) == 0.0)
        discard;

    // Calculate right and bottom deltas:
    vec3 cRight = texture2D(colorTex, offset[1].xy).rgb;
    t = abs(c - cRight);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 cBottom  = texture2D(colorTex, offset[1].zw).rgb;
    t = abs(c - cBottom);
    delta.w = max(max(t.r, t.g), t.b);

    // Calculate the maximum delta in the direct neighborhood:
    vec2 maxDelta = max(delta.xy, delta.zw);

    // Calculate left-left and top-top deltas:
    vec3 cLeftLeft  = texture2D(colorTex, offset[2].xy).rgb;
    t = abs(c - cLeftLeft);
    delta.z = max(max(t.r, t.g), t.b);

    vec3 cTopTop = texture2D(colorTex, offset[2].zw).rgb;
    t = abs(c - cTopTop);
    delta.w = max(max(t.r, t.g), t.b);

    // Calculate the final maximum delta:
    maxDelta = max(maxDelta.xy, delta.zw);
    float finalDelta = max(maxDelta.x, maxDelta.y);

    // Local contrast adaptation:
    edges.xy *= step(finalDelta, SMAA_LOCAL_CONTRAST_ADAPTATION_FACTOR * delta.xy);

    return edges;
  }
#endif

void main() {
  vec4 color;

  #ifdef SMAA_EDGES_DEPTH
    color.xy = SMAADepthEdgeDetection(vTexCoord0, vOffset, uDepthTexture);
  #elif defined(SMAA_EDGES_LUMA)
    color.xy = SMAALumaEdgeDetection(vTexCoord0, vOffset, uColorTexture
      #if SMAA_PREDICATION
      , uDepthTexture
      #endif
    );
  #elif defined(SMAA_EDGES_COLOR)
    color.xy = SMAAColorEdgeDetection(vTexCoord0, vOffset, uColorTexture
      #if SMAA_PREDICATION
      , uDepthTexture
      #endif
    );
  #endif

  gl_FragColor = color;
}
`;

var smaaWeights_vert = /* glsl */ `
#define mad(a, b, c) (a * b + c)

#if defined(SMAA_PRESET_LOW)
#define SMAA_MAX_SEARCH_STEPS 4
#elif defined(SMAA_PRESET_MEDIUM)
#define SMAA_MAX_SEARCH_STEPS 8
#elif defined(SMAA_PRESET_HIGH)
#define SMAA_MAX_SEARCH_STEPS 16
#elif defined(SMAA_PRESET_ULTRA)
#define SMAA_MAX_SEARCH_STEPS 32
#endif

#ifndef SMAA_MAX_SEARCH_STEPS
#define SMAA_MAX_SEARCH_STEPS 16
#endif

attribute vec2 aPosition;

uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

varying vec2 vTexCoord0;
varying vec2 vPixCoord;
varying vec4 vOffset[3];

void main() {
	vTexCoord0 = vec2((aPosition + 1.0) / 2.0);

  vPixCoord = vTexCoord0 * uViewportSize;

  // We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
  vOffset[0] = mad(vec4(uTexelSize, uTexelSize), vec4(-0.25, -0.125,  1.25, -0.125), vTexCoord0.xyxy);
  vOffset[1] = mad(vec4(uTexelSize, uTexelSize), vec4(-0.125, -0.25, -0.125,  1.25), vTexCoord0.xyxy);

  // And these for the searches, they indicate the ends of the loops:
  vOffset[2] = mad(
    vec4(uTexelSize.x, uTexelSize.x, uTexelSize.y, uTexelSize.y),
    vec4(-2.0, 2.0, -2.0, 2.0) * float(SMAA_MAX_SEARCH_STEPS),
    vec4(vOffset[0].xz, vOffset[1].yw)
  );

  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

var smaaWeights_frag = /* glsl */ `precision highp float;
precision highp int;

// Defaults
#ifndef SMAA_THRESHOLD
#define SMAA_THRESHOLD 0.1
#endif
#ifndef SMAA_MAX_SEARCH_STEPS
#define SMAA_MAX_SEARCH_STEPS 16
#endif
#ifndef SMAA_MAX_SEARCH_STEPS_DIAG
#define SMAA_MAX_SEARCH_STEPS_DIAG 8
#endif
#ifndef SMAA_CORNER_ROUNDING
#define SMAA_CORNER_ROUNDING 25
#endif

// Non-Configurable Defines
#define SMAA_AREATEX_MAX_DISTANCE 16
#define SMAA_AREATEX_MAX_DISTANCE_DIAG 20
#define SMAA_AREATEX_PIXEL_SIZE (1.0 / vec2(160.0, 560.0))
#define SMAA_AREATEX_SUBTEX_SIZE (1.0 / 7.0)
#define SMAA_SEARCHTEX_SIZE vec2(66.0, 33.0)
#define SMAA_SEARCHTEX_PACKED_SIZE vec2(64.0, 16.0)
#define SMAA_CORNER_ROUNDING_NORM (float(SMAA_CORNER_ROUNDING) / 100.0)

// Texture Access Defines
#ifndef SMAA_AREATEX_SELECT
#define SMAA_AREATEX_SELECT(sample) sample.rg
#endif

#ifndef SMAA_SEARCHTEX_SELECT
#define SMAA_SEARCHTEX_SELECT(sample) sample.r
#endif

uniform vec2 uViewportSize;
uniform vec2 uTexelSize;

uniform sampler2D uEdgesTexture;
uniform sampler2D uAreaTexture;
uniform sampler2D uSearchTexture;

varying vec2 vTexCoord0;
varying vec4 vOffset[3];
varying vec2 vPixCoord;

#define mad(a, b, c) (a * b + c)
#define saturate(a) clamp(a, 0.0, 1.0)
#define round(v) floor(v + 0.5)
#define SMAASampleLevelZeroOffset(tex, coord, offset) texture2D(tex, coord + offset * uTexelSize)

/**
 * Conditional move:
 */
void SMAAMovc(bvec2 cond, inout vec2 variable, vec2 value) {
  if (cond.x) variable.x = value.x;
  if (cond.y) variable.y = value.y;
}

void SMAAMovc(bvec4 cond, inout vec4 variable, vec4 value) {
  SMAAMovc(cond.xy, variable.xy, value.xy);
  SMAAMovc(cond.zw, variable.zw, value.zw);
}

/**
 * Allows to decode two binary values from a bilinear-filtered access.
 */
vec2 SMAADecodeDiagBilinearAccess(vec2 e) {
  // Bilinear access for fetching 'e' have a 0.25 offset, and we are
  // interested in the R and G edges:
  //
  // +---G---+-------+
  // |   x o R   x   |
  // +-------+-------+
  //
  // Then, if one of these edge is enabled:
  //   Red:   (0.75 * X + 0.25 * 1) => 0.25 or 1.0
  //   Green: (0.75 * 1 + 0.25 * X) => 0.75 or 1.0
  //
  // This function will unpack the values (mad + mul + round):
  // wolframalpha.com: round(x * abs(5 * x - 5 * 0.75)) plot 0 to 1
  e.r = e.r * abs(5.0 * e.r - 5.0 * 0.75);
  return round(e);
}

vec4 SMAADecodeDiagBilinearAccess(vec4 e) {
  e.rb = e.rb * abs(5.0 * e.rb - 5.0 * 0.75);
  return round(e);
}

/**
 * These functions allows to perform diagonal pattern searches.
 */
vec2 SMAASearchDiag1(sampler2D edgesTex, vec2 texcoord, vec2 dir, out vec2 e) {
  vec4 coord = vec4(texcoord, -1.0, 1.0);
  vec3 t = vec3(uTexelSize, 1.0);

  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    if (!(coord.z < float(SMAA_MAX_SEARCH_STEPS_DIAG - 1) && coord.w > 0.9)) break;
    coord.xyz = mad(t, vec3(dir, 1.0), coord.xyz);
    e = texture2D(edgesTex, coord.xy).rg; // LinearSampler
    coord.w = dot(e, vec2(0.5, 0.5));
  }
  return coord.zw;
}

vec2 SMAASearchDiag2(sampler2D edgesTex, vec2 texcoord, vec2 dir, out vec2 e) {
  vec4 coord = vec4(texcoord, -1.0, 1.0);
  coord.x += 0.25 * uTexelSize.x; // See @SearchDiag2Optimization
  vec3 t = vec3(uTexelSize, 1.0);

  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    if (!(coord.z < float(SMAA_MAX_SEARCH_STEPS_DIAG - 1) && coord.w > 0.9)) break;
    coord.xyz = mad(t, vec3(dir, 1.0), coord.xyz);

    // @SearchDiag2Optimization
    // Fetch both edges at once using bilinear filtering:
    e = texture2D(edgesTex, coord.xy).rg; // LinearSampler
    e = SMAADecodeDiagBilinearAccess(e);

    // Non-optimized version:
    // e.g = texture2D(edgesTex, coord.xy).g; // LinearSampler
    // e.r = SMAASampleLevelZeroOffset(edgesTex, coord.xy, vec2(1, 0)).r;

    coord.w = dot(e, vec2(0.5, 0.5));
  }
  return coord.zw;
}

/**
 * Similar to SMAAArea, this calculates the area corresponding to a certain
 * diagonal distance and crossing edges 'e'.
 */
vec2 SMAAAreaDiag(sampler2D areaTex, vec2 dist, vec2 e, float offset) {
  vec2 texcoord = mad(vec2(SMAA_AREATEX_MAX_DISTANCE_DIAG, SMAA_AREATEX_MAX_DISTANCE_DIAG), e, dist);

  // We do a scale and bias for mapping to texel space:
  texcoord = mad(SMAA_AREATEX_PIXEL_SIZE, texcoord, 0.5 * SMAA_AREATEX_PIXEL_SIZE);

  // Diagonal areas are on the second half of the texture:
  texcoord.x += 0.5;

  // Move to proper place, according to the subpixel offset:
  texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

  // Do it!
  return SMAA_AREATEX_SELECT(texture2D(areaTex, texcoord)); // LinearSampler
}

/**
 * This searches for diagonal patterns and returns the corresponding weights.
 */
vec2 SMAACalculateDiagWeights(sampler2D edgesTex, sampler2D areaTex, vec2 texcoord, vec2 e, vec4 subsampleIndices) {
  vec2 weights = vec2(0.0, 0.0);

  // Search for the line ends:
  vec4 d;
  vec2 end;
  if (e.r > 0.0) {
      d.xz = SMAASearchDiag1(edgesTex, texcoord, vec2(-1.0,  1.0), end);
      d.x += float(end.y > 0.9);
  } else
      d.xz = vec2(0.0, 0.0);
  d.yw = SMAASearchDiag1(edgesTex, texcoord, vec2(1.0, -1.0), end);

  if (d.x + d.y > 2.0) { // d.x + d.y + 1 > 3
    // Fetch the crossing edges:
    vec4 coords = mad(vec4(-d.x + 0.25, d.x, d.y, -d.y - 0.25), vec4(uTexelSize, uTexelSize), texcoord.xyxy);
    vec4 c;
    c.xy = SMAASampleLevelZeroOffset(edgesTex, coords.xy, vec2(-1,  0)).rg;
    c.zw = SMAASampleLevelZeroOffset(edgesTex, coords.zw, vec2( 1,  0)).rg;
    c.yxwz = SMAADecodeDiagBilinearAccess(c.xyzw);

    // Non-optimized version:
    // vec4 coords = mad(vec4(-d.x, d.x, d.y, -d.y), vec4(uTexelSize, uTexelSize), texcoord.xyxy);
    // vec4 c;
    // c.x = SMAASampleLevelZeroOffset(edgesTex, coords.xy, vec2(-1,  0)).g;
    // c.y = SMAASampleLevelZeroOffset(edgesTex, coords.xy, vec2( 0,  0)).r;
    // c.z = SMAASampleLevelZeroOffset(edgesTex, coords.zw, vec2( 1,  0)).g;
    // c.w = SMAASampleLevelZeroOffset(edgesTex, coords.zw, vec2( 1, -1)).r;

    // Merge crossing edges at each side into a single value:
    vec2 cc = mad(vec2(2.0, 2.0), c.xz, c.yw);

    // Remove the crossing edge if we didn't found the end of the line:
    SMAAMovc(bvec2(step(0.9, d.zw)), cc, vec2(0.0, 0.0));

    // Fetch the areas for this line:
    weights += SMAAAreaDiag(areaTex, d.xy, cc, subsampleIndices.z);
  }

  // Search for the line ends:
  d.xz = SMAASearchDiag2(edgesTex, texcoord, vec2(-1.0, -1.0), end);
  if (SMAASampleLevelZeroOffset(edgesTex, texcoord, vec2(1, 0)).r > 0.0) {
    d.yw = SMAASearchDiag2(edgesTex, texcoord, vec2(1.0, 1.0), end);
    d.y += float(end.y > 0.9);
  } else {
    d.yw = vec2(0.0, 0.0);
  }

  if (d.x + d.y > 2.0) { // d.x + d.y + 1 > 3
    // Fetch the crossing edges:
    vec4 coords = mad(vec4(-d.x, -d.x, d.y, d.y), vec4(uTexelSize, uTexelSize), texcoord.xyxy);
    vec4 c;
    c.x  = SMAASampleLevelZeroOffset(edgesTex, coords.xy, vec2(-1,  0)).g;
    c.y  = SMAASampleLevelZeroOffset(edgesTex, coords.xy, vec2( 0, -1)).r;
    c.zw = SMAASampleLevelZeroOffset(edgesTex, coords.zw, vec2( 1,  0)).gr;
    vec2 cc = mad(vec2(2.0, 2.0), c.xz, c.yw);

    // Remove the crossing edge if we didn't found the end of the line:
    SMAAMovc(bvec2(step(0.9, d.zw)), cc, vec2(0.0, 0.0));

    // Fetch the areas for this line:
    weights += SMAAAreaDiag(areaTex, d.xy, cc, subsampleIndices.w).gr;
  }

  return weights;
}

/**
 * This allows to determine how much length should we add in the last step
 * of the searches. It takes the bilinearly interpolated edge (see
 * @PSEUDO_GATHER4), and adds 0, 1 or 2, depending on which edges and
 * crossing edges are active.
 */
float SMAASearchLength(sampler2D searchTex, vec2 e, float offset) {
  // The texture is flipped vertically, with left and right cases taking half
  // of the space horizontally:
  vec2 scale = SMAA_SEARCHTEX_SIZE * vec2(0.5, -1.0);
  vec2 bias = SMAA_SEARCHTEX_SIZE * vec2(offset, 1.0);

  // Scale and bias to access texel centers:
  scale += vec2(-1.0,  1.0);
  bias  += vec2( 0.5, -0.5);

  // Convert from pixel coordinates to texcoords:
  // (We use SMAA_SEARCHTEX_PACKED_SIZE because the texture is cropped)
  scale *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;
  bias *= 1.0 / SMAA_SEARCHTEX_PACKED_SIZE;

  // Lookup the search texture:
  return SMAA_SEARCHTEX_SELECT(texture2D(searchTex, mad(scale, e, bias))); // LinearSampler
}

/**
 * Horizontal/vertical search functions for the 2nd pass.
 */
float SMAASearchXLeft(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
  /**
    * @PSEUDO_GATHER4
    * This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
    * sample between edge, thus fetching four edges in a row.
    * Sampling with different offsets in each direction allows to disambiguate
    * which edges are active from the four fetched ones.
    */
  vec2 e = vec2(0.0, 1.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) {
    if (!(texcoord.x > end && e.g > 0.8281 && e.r == 0.0)) break;
    e = texture2D(edgesTex, texcoord).rg; // LinearSampler
    texcoord = mad(-vec2(2.0, 0.0), uTexelSize, texcoord);
  }

  float offset = mad(-(255.0 / 127.0), SMAASearchLength(searchTex, e, 0.0), 3.25);
  return mad(uTexelSize.x, offset, texcoord.x);

  // Non-optimized version:
  // We correct the previous (-0.25, -0.125) offset we applied:
  // texcoord.x += 0.25 * uTexelSize.x;

  // The searches are bias by 1, so adjust the coords accordingly:
  // texcoord.x += uTexelSize.x;

  // Disambiguate the length added by the last step:
  // texcoord.x += 2.0 * uTexelSize.x; // Undo last step
  // texcoord.x -= uTexelSize.x * (255.0 / 127.0) * SMAASearchLength(searchTex, e, 0.0);
  // return mad(uTexelSize.x, offset, texcoord.x);
}

float SMAASearchXRight(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
  vec2 e = vec2(0.0, 1.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) { if (!(texcoord.x < end && e.g > 0.8281 && e.r == 0.0)) break;
    e = texture2D(edgesTex, texcoord).rg; // LinearSampler
    texcoord = mad(vec2(2.0, 0.0), uTexelSize, texcoord);
  }
  float offset = mad(-(255.0 / 127.0), SMAASearchLength(searchTex, e, 0.5), 3.25);
  return mad(-uTexelSize.x, offset, texcoord.x);
}

float SMAASearchYUp(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
  vec2 e = vec2(1.0, 0.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) { if (!(texcoord.y > end && e.r > 0.8281 && e.g == 0.0)) break;
    e = texture2D(edgesTex, texcoord).rg; // LinearSampler
    texcoord = mad(-vec2(0.0, 2.0), uTexelSize, texcoord);
  }
  float offset = mad(-(255.0 / 127.0), SMAASearchLength(searchTex, e.gr, 0.0), 3.25);
  return mad(uTexelSize.y, offset, texcoord.y);
}

float SMAASearchYDown(sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end) {
  vec2 e = vec2(1.0, 0.0);
  for (int i = 0; i < SMAA_MAX_SEARCH_STEPS; i++) { if (!(texcoord.y < end && e.r > 0.8281 && e.g == 0.0)) break;
    e = texture2D(edgesTex, texcoord).rg; // LinearSampler
    texcoord = mad(vec2(0.0, 2.0), uTexelSize, texcoord);
  }
  float offset = mad(-(255.0 / 127.0), SMAASearchLength(searchTex, e.gr, 0.5), 3.25);
  return mad(-uTexelSize.y, offset, texcoord.y);
}

/**
 * Ok, we have the distance and both crossing edges. So, what are the areas
 * at each side of current edge?
 */
vec2 SMAAArea(sampler2D areaTex, vec2 dist, float e1, float e2, float offset) {
  // Rounding prevents precision errors of bilinear filtering:
  vec2 texcoord = mad(vec2(SMAA_AREATEX_MAX_DISTANCE, SMAA_AREATEX_MAX_DISTANCE), round(4.0 * vec2(e1, e2)), dist);

  // We do a scale and bias for mapping to texel space:
  texcoord = mad(SMAA_AREATEX_PIXEL_SIZE, texcoord, 0.5 * SMAA_AREATEX_PIXEL_SIZE);

  // Move to proper place, according to the subpixel offset:
  texcoord.y = mad(SMAA_AREATEX_SUBTEX_SIZE, offset, texcoord.y);

  // Do it!
  return SMAA_AREATEX_SELECT(texture2D(areaTex, texcoord)); // LinearSampler
}

// Corner Detection Functions
void SMAADetectHorizontalCornerPattern(sampler2D edgesTex, inout vec2 weights, vec4 texcoord, vec2 d) {
  #if !defined(SMAA_DISABLE_CORNER_DETECTION)
  vec2 leftRight = step(d.xy, d.yx);
  vec2 rounding = (1.0 - SMAA_CORNER_ROUNDING_NORM) * leftRight;

  rounding /= leftRight.x + leftRight.y; // Reduce blending for pixels in the center of a line.

  vec2 factor = vec2(1.0, 1.0);
  factor.x -= rounding.x * SMAASampleLevelZeroOffset(edgesTex, texcoord.xy, vec2(0,  1)).r;
  factor.x -= rounding.y * SMAASampleLevelZeroOffset(edgesTex, texcoord.zw, vec2(1,  1)).r;
  factor.y -= rounding.x * SMAASampleLevelZeroOffset(edgesTex, texcoord.xy, vec2(0, -2)).r;
  factor.y -= rounding.y * SMAASampleLevelZeroOffset(edgesTex, texcoord.zw, vec2(1, -2)).r;

  weights *= saturate(factor);
  #endif
}

void SMAADetectVerticalCornerPattern(sampler2D edgesTex, inout vec2 weights, vec4 texcoord, vec2 d) {
  #if !defined(SMAA_DISABLE_CORNER_DETECTION)
  vec2 leftRight = step(d.xy, d.yx);
  vec2 rounding = (1.0 - SMAA_CORNER_ROUNDING_NORM) * leftRight;

  rounding /= leftRight.x + leftRight.y;

  vec2 factor = vec2(1.0, 1.0);
  factor.x -= rounding.x * SMAASampleLevelZeroOffset(edgesTex, texcoord.xy, vec2( 1, 0)).g;
  factor.x -= rounding.y * SMAASampleLevelZeroOffset(edgesTex, texcoord.zw, vec2( 1, 1)).g;
  factor.y -= rounding.x * SMAASampleLevelZeroOffset(edgesTex, texcoord.xy, vec2(-2, 0)).g;
  factor.y -= rounding.y * SMAASampleLevelZeroOffset(edgesTex, texcoord.zw, vec2(-2, 1)).g;

  weights *= saturate(factor);
  #endif
}

void main() {
  vec4 subsampleIndices = vec4(0.0); // Just pass zero for SMAA 1x, see @SUBSAMPLE_INDICES.
  // subsampleIndices = vec4(1.0, 1.0, 1.0, 0.0);
  vec4 weights = vec4(0.0, 0.0, 0.0, 0.0);
  vec2 e = texture2D(uEdgesTexture, vTexCoord0).rg;

  if (e.g > 0.0) { // Edge at north

    #if !defined(SMAA_DISABLE_DIAG_DETECTION)
    // Diagonals have both north and west edges, so searching for them in
    // one of the boundaries is enough.
    weights.rg = SMAACalculateDiagWeights(uEdgesTexture, uAreaTexture, vTexCoord0, e, subsampleIndices);

    // We give priority to diagonals, so if we find a diagonal we skip
    // horizontal/vertical processing.
    if (weights.r == -weights.g) { // weights.r + weights.g == 0.0
    #endif

    vec2 d;

    // Find the distance to the left:
    vec3 coords;
    coords.x = SMAASearchXLeft(uEdgesTexture, uSearchTexture, vOffset[0].xy, vOffset[2].x);
    coords.y = vOffset[1].y; // vOffset[1].y = vTexCoord0.y - 0.25 * uTexelSize.y (@CROSSING_OFFSET)
    d.x = coords.x;

    // Now fetch the left crossing edges, two at a time using bilinear
    // filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
    // discern what value each edge has:
    float e1 = texture2D(uEdgesTexture, coords.xy).r; // LinearSampler

    // Find the distance to the right:
    coords.z = SMAASearchXRight(uEdgesTexture, uSearchTexture, vOffset[0].zw, vOffset[2].y);
    d.y = coords.z;

    // We want the distances to be in pixel units (doing this here allow to
    // better interleave arithmetic and memory accesses):
    d = abs(round(mad(uViewportSize.xx, d, -vPixCoord.xx)));

    // SMAAArea below needs a sqrt, as the areas texture is compressed
    // quadratically:
    vec2 sqrt_d = sqrt(d);

    // Fetch the right crossing edges:
    float e2 = SMAASampleLevelZeroOffset(uEdgesTexture, coords.zy, vec2(1, 0)).r;

    // Ok, we know how this pattern looks like, now it is time for getting
    // the actual area:
    weights.rg = SMAAArea(uAreaTexture, sqrt_d, e1, e2, subsampleIndices.y);

    // Fix corners:
    coords.y = vTexCoord0.y;
    SMAADetectHorizontalCornerPattern(uEdgesTexture, weights.rg, coords.xyzy, d);

    #if !defined(SMAA_DISABLE_DIAG_DETECTION)
    } else
    e.r = 0.0; // Skip vertical processing.
    #endif
  }

  if (e.r > 0.0) { // Edge at west
    vec2 d;

    // Find the distance to the top:
    vec3 coords;
    coords.y = SMAASearchYUp(uEdgesTexture, uSearchTexture, vOffset[1].xy, vOffset[2].z);
    coords.x = vOffset[0].x; // vOffset[1].x = vTexCoord0.x - 0.25 * uTexelSize.x;
    d.x = coords.y;

    // Fetch the top crossing edges:
    float e1 = texture2D(uEdgesTexture, coords.xy).g; // LinearSampler

    // Find the distance to the bottom:
    coords.z = SMAASearchYDown(uEdgesTexture, uSearchTexture, vOffset[1].zw, vOffset[2].w);
    d.y = coords.z;

    // We want the distances to be in pixel units:
    d = abs(round(mad(uViewportSize.yy, d, -vPixCoord.yy)));

    // SMAAArea below needs a sqrt, as the areas texture is compressed
    // quadratically:
    vec2 sqrt_d = sqrt(d);

    // Fetch the bottom crossing edges:
    float e2 = SMAASampleLevelZeroOffset(uEdgesTexture, coords.xz, vec2(0, 1)).g;

    // Get the area for this direction:
    weights.ba = SMAAArea(uAreaTexture, sqrt_d, e1, e2, subsampleIndices.x);

    // Fix corners:
    coords.x = vTexCoord0.x;
    SMAADetectVerticalCornerPattern(uEdgesTexture, weights.ba, coords.xyxz, d);
  }

  gl_FragColor = weights;
}
`;

var smaaBlend_vert = /* glsl */ `
#define mad(a, b, c) (a * b + c)

attribute vec2 aPosition;

uniform vec2 uTexelSize;

varying vec2 vTexCoord0;
varying vec4 vOffset;

void main() {
	vTexCoord0 = vec2((aPosition + 1.0) / 2.0);
	vOffset = mad(vec4(uTexelSize, uTexelSize), vec4(1.0, 0.0, 0.0,  1.0), vTexCoord0.xyxy);

  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

var smaaBlend_frag = /* glsl */ `precision highp float;

#define mad(a, b, c) (a * b + c)

uniform sampler2D uColorTexture;
uniform sampler2D uBlendTexture;

uniform vec2 uTexelSize;

varying vec2 vTexCoord0;
varying vec4 vOffset;

/**
 * Conditional move:
 */
void SMAAMovc(bvec2 cond, inout vec2 variable, vec2 value) {
  if (cond.x) variable.x = value.x;
  if (cond.y) variable.y = value.y;
}

void SMAAMovc(bvec4 cond, inout vec4 variable, vec4 value) {
  SMAAMovc(cond.xy, variable.xy, value.xy);
  SMAAMovc(cond.zw, variable.zw, value.zw);
}

void main() {
  vec4 color;

  // Fetch the blending weights for current pixel:
  vec4 a;
  a.x = texture2D(uBlendTexture, vOffset.xy).a; // Right
  a.y = texture2D(uBlendTexture, vOffset.zw).g; // Top
  a.wz = texture2D(uBlendTexture, vTexCoord0).xz; // Bottom / Left

  // Is there any blending weight with a value greater than 0.0?
  if (dot(a, vec4(1.0, 1.0, 1.0, 1.0)) <= 1e-5) {
    color = texture2D(uColorTexture, vTexCoord0); // LinearSampler
  } else {
    bool h = max(a.x, a.z) > max(a.y, a.w); // max(horizontal) > max(vertical)

    // Calculate the blending offsets:
    vec4 blendingOffset = vec4(0.0, a.y, 0.0, a.w);
    vec2 blendingWeight = a.yw;
    SMAAMovc(bvec4(h, h, h, h), blendingOffset, vec4(a.x, 0.0, a.z, 0.0));
    SMAAMovc(bvec2(h, h), blendingWeight, a.xz);
    blendingWeight /= dot(blendingWeight, vec2(1.0, 1.0));

    // Calculate the texture coordinates:
    vec4 blendingCoord = mad(blendingOffset, vec4(uTexelSize, -uTexelSize), vTexCoord0.xyxy);

    // We exploit bilinear filtering to mix current pixel with the chosen
    // neighbor:
    color = blendingWeight.x * texture2D(uColorTexture, blendingCoord.xy); // LinearSampler
    color += blendingWeight.y * texture2D(uColorTexture, blendingCoord.zw); // LinearSampler
  }

  gl_FragColor = color;
}
`;

const SMAATextures = {
    area: "data:image/png;base64,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",
    search: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAACm53kpAAAAeElEQVRYR+2XSwqAMAxEJ168ePEqwRSKhIIiuHjJqiU0gWE+1CQdApcVAMUAuARaMGCX1MIL/Ow13++9lW2s3mW9MWvsnWc/2fvGygwPAN4E8QzAA4CXAB6AHjG4JTHYI1ey3pcx6FHnEfhLDOIBKAmUBK6/ANUDTlROXAHd9EC1AAAAAElFTkSuQmCC"
};

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  PRESETS: presets_glsl,
  SMAATextures: SMAATextures,
  SMAA_BLEND_FRAG: smaaBlend_frag,
  SMAA_BLEND_VERT: smaaBlend_vert,
  SMAA_EDGES_FRAG: smaaEdges_frag,
  SMAA_EDGES_VERT: smaaEdges_vert,
  SMAA_WEIGHTS_FRAG: smaaWeights_frag,
  SMAA_WEIGHTS_VERT: smaaWeights_vert
});

export { index$5 as chunks, parser, index$4 as pipeline, index$3 as postProcessing, index$2 as reflectionProbe, index$1 as skybox, index as smaa, glslToneMap as toneMap };
