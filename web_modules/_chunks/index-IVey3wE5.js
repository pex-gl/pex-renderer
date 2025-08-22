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

var math_glsl = /*#__PURE__*/Object.freeze({
  __proto__: null,
  HALF_PI: HALF_PI,
  PI: PI,
  TWO_PI: TWO_PI,
  inverseMat4: inverseMat4,
  multQuat: multQuat,
  quatToMat4: quatToMat4,
  random: random,
  round: round,
  saturate: saturate,
  transposeMat3: transposeMat3
});

var encodeDecode_glsl = /* glsl */ `
#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

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

// RGBM
// http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec3 decodeRGBM (vec4 rgbm) {
  vec3 r = rgbm.rgb * (7.0 * rgbm.a);
  return r * r;
}
vec4 encodeRGBM (vec3 rgb_0) {
  vec4 r;
  r.xyz = (1.0 / 7.0) * sqrt(rgb_0);
  r.a = max(max(r.x, r.y), r.z);
  r.a = clamp(r.a, 1.0 / 255.0, 1.0);
  r.a = ceil(r.a * 255.0) / 255.0;
  r.xyz /= r.a;
  return r;
}

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
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
  uniform int uReflectionMapEncoding;

  #define MAX_MIPMAP_LEVEL 5.0

  vec3 getPrefilteredReflection(vec3 reflected, float roughness) {
    float lod = pow(roughness, 2.0) * MAX_MIPMAP_LEVEL; // TODO: verify reflection probe blurring code
    // float lod = pow(roughness, 1.5) * MAX_MIPMAP_LEVEL;
    float upLod = floor(lod);
    float downLod = ceil(lod);

    vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, upLod, uReflectionMapSize)), uReflectionMapEncoding).rgb;
    vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, downLod, uReflectionMapSize)), uReflectionMapEncoding).rgb;

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
    vec3 diffuseIrradiance = getIrradiance(data.normalWorld, uReflectionMap, uReflectionMapSize, uReflectionMapEncoding);
    vec3 Fd = data.diffuseColor * diffuseIrradiance * ao;

    #ifdef USE_DIFFUSE_TRANSMISSION
      vec3 diffuseTransmissionIBL = getIrradiance(-data.normalWorld, uReflectionMap, uReflectionMapSize, uReflectionMapEncoding) * data.diffuseTransmissionColor;
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
      data.baseColor = decode(uBaseColor, SRGB).rgb * decode(texelColor, SRGB).rgb;
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

    data.emissiveColor = decode(texture2D(uEmissiveColorTexture, texCoord), SRGB).rgb;

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
      specularColor *= decode(texture2D(uSpecularColorTexture, texCoordSpecularColor), SRGB).rgb;
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
      return vec4(decode(uDiffuse, SRGB).rgb, uDiffuse.a) * vec4(decode(texelColor, SRGB).rgb, texelColor.a);
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
      return vec4(uSpecular, uGlossiness) * vec4(decode(vec4(specGloss.rgb, 1.0), SRGB).rgb, specGloss.a);
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
float max3(vec3 v) { return max(max(v.x, v.y), v.z); }

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
      data.sheenColor = decode(uSheenColor, SRGB).rgb * decode(texelColor, SRGB).rgb;
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
      diffuseTransmissionColor *= decode(texture2D(uDiffuseTransmissionColorTexture, texCoordDiffuseTransmissionColor), SRGB).rgb;
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

// 0: Default, 1: Golden, 2: Punchy
#ifndef AGX_LOOK
  #define AGX_LOOK 0
#endif

vec3 agxAscCdl(vec3 color, vec3 slope, vec3 offset, vec3 power, float sat) {
  const vec3 lw = vec3(0.2126, 0.7152, 0.0722);
  float luma = dot(color, lw);
  vec3 c = pow(color * slope + offset, power);
  return luma + sat * (c - luma);
}

// Sample usage
vec3 agx(vec3 color) {
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
  #if AGX_LOOK == 1
    // Golden
    color = agxAscCdl(color, vec3(1.0, 0.9, 0.5), vec3(0.0), vec3(0.8), 1.3);
  #elif AGX_LOOK == 2
    // Punchy
    color = agxAscCdl(color, vec3(1.0), vec3(0.0), vec3(1.35), 1.4);
  #endif

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

/**
 * @alias module:pipeline.blit.frag
 * @type {string}
 */ var blitFrag = /* glsl */ `precision highp float;

${frag}

uniform sampler2D uTexture;

uniform float uExposure;
uniform int uOutputEncoding;

varying vec2 vTexCoord0;

// Includes
${PI}
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = texture2D(uTexture, vTexCoord0);

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragColor = encode(color, uOutputEncoding);

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

uniform float uExposure;
uniform int uOutputEncoding;

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
${Object.values(glslToneMap).join("\n")}

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

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);

  #ifdef USE_DRAW_BUFFERS
    #if LOCATION_NORMAL >= 0
      gl_FragData[LOCATION_NORMAL] = vec4(data.normalView * 0.5 + 0.5, 1.0);
    #endif
    #if LOCATION_EMISSIVE >= 0
      gl_FragData[LOCATION_EMISSIVE] = encode(vec4(data.emissiveColor, 1.0), uOutputEncoding);
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

uniform float uExposure;
uniform int uOutputEncoding;

uniform vec4 uBaseColor;

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
varying vec4 vColor;
#endif

// Includes
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = decode(uBaseColor, SRGB);

  #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
    color *= decode(vColor, SRGB);
  #endif

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragData[0] = encode(color, uOutputEncoding);

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

uniform float uExposure;
uniform int uOutputEncoding;

uniform vec4 uBaseColor;

#ifdef USE_VERTEX_COLORS
varying vec4 vColor;
#endif

// Includes
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  vec4 color = decode(uBaseColor, SRGB);

  #ifdef USE_VERTEX_COLORS
    color *= decode(vColor, SRGB);
  #endif

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragData[0] = encode(color, uOutputEncoding);

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

uniform float uExposure;
uniform int uOutputEncoding;

varying vec4 vColor;

// Includes
${encodeDecode_glsl}
${Object.values(glslToneMap).join("\n")}

#define HOOK_FRAG_DECLARATIONS_END

void main () {
  vec4 color = decode(vColor, SRGB);

  color.rgb *= uExposure;

  #if defined(TONE_MAP)
    color.rgb = TONE_MAP(color.rgb);
  #endif

  gl_FragData[0] = encode(color, uOutputEncoding);

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

var index = /*#__PURE__*/Object.freeze({
  __proto__: null,
  basic: basic,
  blit: blit,
  depthPass: depthPass,
  depthPrePass: depthPrePass,
  error: error,
  helper: helper,
  line: line,
  overlay: overlay,
  standard: standard
});

export { pcss_glsl as A, shadowing_glsl as B, sheenColor_glsl as C, specular_glsl as D, specularGlossiness_glsl as E, textureCoordinates_glsl as F, transmission_glsl as G, frag as H, assignment as I, saturate as J, random as K, glslToneMap as L, vert as M, round as N, HALF_PI as O, PI as P, inverseMat4 as Q, transposeMat3 as R, index as S, TWO_PI as T, alpha_glsl as a, blit as b, ambientOcclusion_glsl as c, baseColor_glsl as d, brdf_glsl as e, clearCoat_glsl as f, depthPack_glsl as g, depthRead_glsl as h, depthUnpack_glsl as i, direct_glsl as j, emissiveColor_glsl as k, encodeDecode_glsl as l, indirect_glsl as m, irradiance_glsl as n, lightAmbient_glsl as o, lightArea_glsl as p, lightDirectional_glsl as q, lightPoint_glsl as r, lightSpot_glsl as s, math_glsl as t, metallicRoughness_glsl as u, normal_glsl as v, normalPerturb_glsl as w, octMap_glsl as x, output_glsl as y, pcf_glsl as z };
