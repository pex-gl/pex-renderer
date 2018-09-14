// TODO: this is already browserified, need to split back to chunks
const tonemapUncharted2 = require('./lib/glsl-tonemap-uncharted2/index.glsl.js')
module.exports = `
#ifdef GL_ES
  #extension GL_OES_standard_derivatives : require
#ifdef USE_DRAW_BUFFERS
  #extension GL_EXT_draw_buffers : require
#endif
#else
#endif

#ifdef GL_ES
precision mediump float;
#endif

#ifdef USE_TONEMAPPING
${tonemapUncharted2}
uniform float uExposure;
#endif

varying vec3 vNormalWorld;
varying vec3 vNormalView;

varying vec2 vTexCoord0;

varying vec3 vPositionWorld;
varying vec3 vPositionView;

#ifdef USE_TANGENTS
varying vec4 vTangentView;
#endif

#ifdef USE_VERTEX_COLORS
varying vec4 vColor;
#endif

#ifdef USE_INSTANCED_COLOR
varying vec4 vColor;
#endif

#ifdef GL_ES
uniform highp mat4 uInverseViewMatrix;
uniform highp mat4 uViewMatrix;
uniform highp mat3 uNormalMatrix;
uniform highp mat4 uModelMatrix;
#else
uniform mat4 uInverseViewMatrix;
uniform mat4 uViewMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uModelMatrix;
#endif

uniform vec3 uCameraPosition;

#ifdef USE_AO
uniform sampler2D uAO;
uniform vec2 uScreenSize;
#endif

uniform int uOutputEncoding;

#define PI 3.14159265359


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

vec2 envMapOctahedral(vec3 dir, float mipmapLevel, float roughnessLevel) {
  float width = 2048.0;
  float maxLevel = 11.0; // this should come from log of size
  float levelSizeInPixels = pow(2.0, 1.0 + mipmapLevel + roughnessLevel);
  float levelSize = max(64.0, width / levelSizeInPixels);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + roughnessLevel);
  float vOffset = (width - pow(2.0, maxLevel - roughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - mipmapLevel);
  vec2 uv = envMapOctahedral(dir, levelSize);
  uv *= levelSize;

  return (uv + vec2(hOffset, vOffset)) / width;
}


#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

const float gamma_1 = 2.2;

float toLinear(float v) {
  return pow(v, gamma_1);
}

vec2 toLinear(vec2 v) {
  return pow(v, vec2(gamma_1));
}

vec3 toLinear(vec3 v) {
  return pow(v, vec3(gamma_1));
}

vec4 toLinear(vec4 v) {
  return vec4(toLinear(v.rgb), v.a);
}

// source http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec3 decodeRGBM (vec4 rgbm) {
  vec3 r = rgbm.rgb * (7.0 * rgbm.a);
  return r * r;
}

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}

#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

const float gamma_0 = 2.2;

float toGamma(float v) {
  return pow(v, 1.0 / gamma_0);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma_0));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma_0));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}

// source http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec4 encodeRGBM (vec3 rgb_0) {
  vec4 r;
  r.xyz = (1.0 / 7.0) * sqrt(rgb_0);
  r.a = max(max(r.x, r.y), r.z);
  r.a = clamp(r.a, 1.0 / 255.0, 1.0);
  r.a = ceil(r.a * 255.0) / 255.0;
  r.xyz /= r.a;
  return r;
}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
}


struct PBRData {
  mat4 inverseViewMatrix;
  vec2 texCoord0;
  vec3 normalView;
  vec4 tangentView;
  vec3 positionWorld;
  vec3 positionView;
  vec3 eyeDirView;
  vec3 eyeDirWorld;
  vec3 normalWorld; //N, world space
  vec3 viewWorld; //V, view vector from position to camera, world space
  vec3 lightWorld; //L, light vector from position to light, world space
  float NdotV;
  float NdotL;
  float NdotH;
  float LdotH;
  float HdotV;
  vec3 baseColor;
  vec3 emissiveColor;
  float opacity;
  float roughness;    // roughness value, as authored by the model creator (input to shader)
  float metallic;              // metallic value at the surface
  float alphaRoughness;         // roughness mapped to a more linear change in the roughness (proposed by [2])
  vec3 diffuseColor;            // color contribution from diffuse lighting
  vec3 specularColor;           // color contribution from specular lighting
  vec3 indirectDiffuse;  // contribution from IBL light probe
  vec3 indirectSpecular; // contribution from IBL light probe
  vec3 directDiffuse;  // contribution from light sources
  vec3 directSpecular; // contribution from light sources
};

#ifndef USE_USE_UNLIT_WORKFLOW


//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToEyeSpaceProj(float ndcDepth, float near, float far) {
    return 2.0 * near * far / (far + near - ndcDepth * (far - near));
}

//otho
//z = (f - n) * (zn + (f + n)/(f-n))/2
//http://www.ogldev.org/www/tutorial47/tutorial47.html
float ndcDepthToEyeSpace(float ndcDepth, float near, float far) {
    return (far - near) * (ndcDepth + (far + near) / (far - near)) / 2.0;
}

float readDepth(sampler2D depthMap, vec2 coord, float near, float far) {
    float z_b = texture2D(depthMap, coord).r;
    float z_n = 2.0 * z_b - 1.0;
    return ndcDepthToEyeSpace(z_n, near, far);
}

float texture2DCompare(sampler2D depthMap, vec2 uv, float compare, float near, float far) {
    float depth = readDepth(depthMap, uv, near, far);
    return step(compare, depth);
}

float texture2DShadowLerp(sampler2D depthMap, vec2 size, vec2 uv, float compare, float near, float far){
    vec2 texelSize = vec2(1.0)/size;
    vec2 f = fract(uv*size+0.5);
    vec2 centroidUV = floor(uv*size+0.5)/size;

    float lb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 0.0), compare, near, far);
    float lt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 1.0), compare, near, far);
    float rb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 0.0), compare, near, far);
    float rt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 1.0), compare, near, far);
    float a = mix(lb, lt, f.y);
    float b = mix(rb, rt, f.y);
    float c = mix(a, b, f.x);
    return c;
}

float PCF3x3(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far){
    float result = 0.0;
    for(int x=-1; x<=1; x++){
        for(int y=-1; y<=1; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare, near, far);
        }
    }
    return result/9.0;
}

float PCF5x5(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare, near, far);
        }
    }
    return result/25.0;
}

float directionalShadow(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far) {
#if SHADOW_QUALITY == 0
  float illuminated = 1.0;
#endif
#if SHADOW_QUALITY == 1
  float illuminated = texture2DCompare(depths, uv, compare, near, far);
#endif
#if SHADOW_QUALITY == 2
  float illuminated = texture2DShadowLerp(depths, size, uv, compare, near, far);
#endif
#if SHADOW_QUALITY == 3
  float illuminated = PCF3x3(depths, size, uv, compare, near, far);
#endif
#if SHADOW_QUALITY == 4
  float illuminated = PCF5x5(depths, size, uv, compare, near, far);
#endif
  return illuminated;
}

#ifdef USE_ALPHA_MAP
uniform sampler2D uAlphaMap;
#endif

#ifdef USE_ALPHA_TEST
  uniform float uAlphaTest; //assumes sRGB color, not linear
  void AlphaTest(inout PBRData data) {
    //if (length(data.emissiveColor) < 0.1) discard;
    if (data.opacity < uAlphaTest) discard;
    //else data.baseColor = vec3(1.0, 0.0, 0.0);
  }
#endif



//FresnelSchlick
vec3 SpecularReflection(PBRData data) {
  float cosTheta = data.HdotV;
  return data.specularColor + (1.0 - data.specularColor) * pow(1.0 - cosTheta, 5.0);
}


//Smith G
float GeometricOcclusion(PBRData data) {
  float NdotL = data.NdotL;
  float NdotV = data.NdotV;
  float r = data.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}


// GGX
float MicrofacetDistribution(PBRData data) {
  float a2 = data.alphaRoughness * data.alphaRoughness;
  float NdotH2 = data.NdotH * data.NdotH;

  float nom = a2;
  float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  if (denom > 0.0) {
    return nom / denom;
  } else {
    return 1.0;
  }
}


//DiffuseLambert
vec3 DiffuseLambert(vec3 color) {
  return color / PI;
}



#if NUM_AMBIENT_LIGHTS > 0

struct AmbientLight {
  vec4 color;
};

uniform AmbientLight uAmbientLights[NUM_AMBIENT_LIGHTS];
uniform sampler2D uAmbientLightShadowMaps[NUM_AMBIENT_LIGHTS];

void EvaluateAmbientLight(inout PBRData data, AmbientLight light, int i) {
  vec3 lightColor = decode(light.color, 3).rgb;
  lightColor *= light.color.a;
  data.indirectDiffuse += data.diffuseColor * lightColor;
}
#endif


#if NUM_DIRECTIONAL_LIGHTS > 0

struct DirectionalLight {
  vec3 direction;
  vec4 color;
  mat4 projectionMatrix;
  mat4 viewMatrix;
  float near;
  float far;
  float bias;
  vec2 shadowMapSize;
};

uniform DirectionalLight uDirectionalLights[NUM_DIRECTIONAL_LIGHTS];
uniform sampler2D uDirectionalLightShadowMaps[NUM_DIRECTIONAL_LIGHTS];

void EvaluateDirectionalLight(inout PBRData data, DirectionalLight light, int i) {
  //shadows
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0);
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
  float lightDeviceCoordsZ = lightDeviceCoordsPosition.z / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = 0.0;

  if (i == 0) illuminated += directionalShadow(uDirectionalLightShadowMaps[0], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#if NUM_DIRECTIONAL_LIGHTS >= 2
  if (i == 1) illuminated += directionalShadow(uDirectionalLightShadowMaps[1], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 3
  if (i == 2) illuminated += directionalShadow(uDirectionalLightShadowMaps[2], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 4
  if (i == 3) illuminated += directionalShadow(uDirectionalLightShadowMaps[3], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 5
  if (i == 4) illuminated += directionalShadow(uDirectionalLightShadowMaps[4], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 6
  if (i == 5) illuminated += directionalShadow(uDirectionalLightShadowMaps[5], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 7
  if (i == 6) illuminated += directionalShadow(uDirectionalLightShadowMaps[6], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
#if NUM_DIRECTIONAL_LIGHTS >= 8
  if (i == 7) illuminated += directionalShadow(uDirectionalLightShadowMaps[7], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif

  if (illuminated > 0.0) {
    data.lightWorld = normalize(-light.direction);
    vec3 N = data.normalWorld;
    vec3 V = data.viewWorld;
    vec3 L = data.lightWorld;
    vec3 H = normalize(V + L);
    float NdotV = max(0.0, dot(N, V));

    data.NdotL = clamp(dot(N, L), 0.001, 1.0);
    data.HdotV = max(0.0, dot(H, V));
    data.NdotH = max(0.0, dot(N, H));
    data.LdotH = max(0.0, dot(L, H));

    vec3 F = SpecularReflection(data);
    float D = MicrofacetDistribution(data);
    float G = GeometricOcclusion(data);

    vec3 nominator = F * G * D;
    float denominator = 4.0 * data.NdotV * data.NdotL + 0.001;
    vec3 specularBrdf = nominator / denominator;

    vec3 lightColor = decode(light.color, 3).rgb;
    lightColor *= light.color.a; // intensity

    //TODO: is irradiance the right name? Three.js is using it
    vec3 irradiance = data.NdotL * lightColor * illuminated;

    //TODO: (1 - F) comes from glTF spec, three.js doesn't have it? Schlick BRDF
    data.directDiffuse += (1.0 - F) * DiffuseLambert(data.diffuseColor) * irradiance;
    data.directSpecular += specularBrdf * irradiance;
    //data.directSpecular = vec3(G);
  }
}
#endif


#if NUM_POINT_LIGHTS > 0

struct PointLight {
  vec3 position;
  vec4 color;
  float range;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];

void EvaluatePointLight(inout PBRData data, PointLight light, int i) {
  float illuminated = 1.0; // no shadows yet
  if (illuminated > 0.0) {
    data.lightWorld = light.position - vPositionWorld;
    float dist = length(data.lightWorld);
    data.lightWorld /= dist;

    vec3 N = data.normalWorld;
    vec3 V = data.viewWorld;
    vec3 L = data.lightWorld;
    vec3 H = normalize(V + L);
    float NdotV = max(0.0, dot(N, V));

    data.NdotL = clamp(dot(N, L), 0.001, 1.0);
    data.HdotV = max(0.0, dot(H, V));
    data.NdotH = max(0.0, dot(N, H));
    data.LdotH = max(0.0, dot(L, H));

    vec3 F = SpecularReflection(data);
    float D = MicrofacetDistribution(data);
    float G = GeometricOcclusion(data);

    vec3 nominator = F * G * D;
    float denominator = 4.0 * data.NdotV * data.NdotL + 0.001;
    vec3 specularBrdf = nominator / denominator;

    vec3 lightColor = decode(light.color, 3).rgb;
    lightColor *= light.color.a; // intensity

    float distanceRatio = clamp(1.0 - pow(dist/light.range, 4.0), 0.0, 1.0);
    float falloff = (distanceRatio * distanceRatio) / (max(dist * dist, 0.01));

    //TODO: is irradiance the right name? Three.js is using it
    vec3 irradiance = data.NdotL * lightColor * illuminated;
    irradiance *= falloff;

    //TODO: (1 - F) comes from glTF spec, three.js doesn't have it? Schlick BRDF
    data.directDiffuse += (1.0 - F) * DiffuseLambert(data.diffuseColor) * irradiance;
    data.directSpecular += specularBrdf * irradiance;
  }
}
#endif


#if NUM_SPOT_LIGHTS > 0

struct SpotLight {
    vec3 position;
    vec3 direction;
    vec4 color;
    float angle;
    float range;
};

uniform SpotLight uSpotLights[NUM_SPOT_LIGHTS];

void EvaluateSpotLight(inout PBRData data, SpotLight light, int i) {
  float illuminated = 1.0; // no shadows yet
  if (illuminated > 0.0) {
    data.lightWorld = light.position - data.positionWorld;
    float dist = length(data.lightWorld);
    data.lightWorld /= dist;

    vec3 N = data.normalWorld;
    vec3 V = data.viewWorld;
    vec3 L = data.lightWorld;
    vec3 H = normalize(V + L);
    float NdotV = max(0.0, dot(N, V));

    data.NdotL = clamp(dot(N, L), 0.001, 1.0);
    data.HdotV = max(0.0, dot(H, V));
    data.NdotH = max(0.0, dot(N, H));
    data.LdotH = max(0.0, dot(L, H));

    vec3 F = SpecularReflection(data);
    float D = MicrofacetDistribution(data);
    float G = GeometricOcclusion(data);

    vec3 nominator = F * G * D;
    float denominator = 4.0 * data.NdotV * data.NdotL + 0.001;
    vec3 specularBrdf = nominator / denominator;

    vec3 lightColor = decode(light.color, 3).rgb;
    lightColor *= light.color.a; // intensity

    float distanceRatio = clamp(1.0 - pow(dist/light.range, 4.0), 0.0, 1.0);
    float distanceFalloff = (distanceRatio * distanceRatio) / (max(dist * dist, 0.01));

    float fCosine = max(0.0, dot(light.direction, -L));
    float cutOff = cos(light.angle);

    float fDif = 1.0 - cutOff;
    float falloff = clamp((fCosine - cutOff)/fDif, 0.0, 1.0);
    falloff = pow(falloff, 2.0) * distanceFalloff;

    //TODO: (1 - F) comes from glTF spec, three.js doesn't have it? Schlick BRDF
    vec3 irradiance = data.NdotL * lightColor * illuminated;
    irradiance *= falloff;
    data.directDiffuse += (1.0 - F) * DiffuseLambert(data.diffuseColor) * irradiance;
    data.directSpecular += specularBrdf * irradiance;
  }
}
#endif


#if NUM_AREA_LIGHTS > 0

struct AreaLight {
    vec3 position;
    vec2 size;
    vec4 color;
    float intensity;
    vec4 rotation;
};

uniform AreaLight uAreaLights[NUM_AREA_LIGHTS];

uniform sampler2D ltc_mat;
uniform sampler2D ltc_mag;

uniform mat4  view;

const vec2  resolution = vec2(1280.0, 720.0);

const int   sampleCount = 4;

const int   NUM_SAMPLES_3020430251 = 8;
const float LUT_SIZE_3020430251  = 64.0;
const float LUT_SCALE_3020430251 = (LUT_SIZE_3020430251 - 1.0)/LUT_SIZE_3020430251;
const float LUT_BIAS_3020430251  = 0.5/LUT_SIZE_3020430251;
const float pi_0 = 3.14159265;

// Tracing and intersection
///////////////////////////
///
///
struct Ray
{
    vec3 origin;
    vec3 dir;
};

struct Rect
{
    vec3  origin;
    vec4  plane;
    float sizex;
    float sizey;
};

bool RayPlaneIntersect(Ray ray, vec4 plane, out float t)
{
    t = -dot(plane, vec4(ray.origin, 1.0))/dot(plane.xyz, ray.dir);
    return t > 0.0;
}

bool RayRectIntersect(Ray ray, Rect rect, out float t)
{
    bool intersect = RayPlaneIntersect(ray, rect.plane, t);
    if (intersect)
    {
        vec3 pos = ray.origin + ray.dir*t;
        vec3 lpos = pos - rect.origin;
        if (abs(lpos.x) > rect.sizex || abs(lpos.y) > rect.sizey)
            intersect = false;
    }

    return intersect;
}

// Adapted from:
// https://www.shadertoy.com/view/4djSRW
float hash(float x, float y)
{
    vec2 p = vec2(x, y);
    p  = fract(p * vec2(443.8975, 397.2973));
    p += dot(p.xy, p.yx + 19.19);
    return fract(p.x + p.y);
}

//TODO: which coordinate space?
Ray GenerateCameraRay(float u1, float u2)
{
    Ray ray;

    // Random jitter within pixel for AA, huh? what jitter
    vec2 xy = 2.0*(gl_FragCoord.xy)/resolution - vec2(1.0);

    ray.dir = normalize(vec3(xy, 2.0));

    float focalDistance = 2.0;
    float ft = focalDistance/ray.dir.z;
    vec3 pFocus = ray.dir*ft;

    ray.origin = vec3(0);
    ray.dir    = normalize(pFocus - ray.origin);

    // Apply camera transform
    ray.origin = (view*vec4(ray.origin, 1)).xyz;
    ray.dir    = (view*vec4(ray.dir,    0)).xyz;

    return ray;
}

vec3 mul(mat3 m, vec3 v)
{
    return m * v;
}

mat3 mul(mat3 m1, mat3 m2)
{
    return m1 * m2;
}

int modi(int x, int y)
{
    return int(mod(float(x), float(y)));
}

mat3 transpose(mat3 v)
{
    mat3 tmp;
    tmp[0] = vec3(v[0].x, v[1].x, v[2].x);
    tmp[1] = vec3(v[0].y, v[1].y, v[2].y);
    tmp[2] = vec3(v[0].z, v[1].z, v[2].z);

    return tmp;
}

struct SphQuad
{
    vec3 o, x, y, z;
    float z0, z0sq;
    float x0, y0, y0sq;
    float x1, y1, y1sq;
    float b0, b1, b0sq, k;
    float S;
};

SphQuad SphQuadInit(vec3 s, vec3 ex, vec3 ey, vec3 o)
{
    SphQuad squad;

    squad.o = o;
    float exl = length(ex);
    float eyl = length(ey);

    // compute local reference system ’R’
    squad.x = ex / exl;
    squad.y = ey / eyl;
    squad.z = cross(squad.x, squad.y);

    // compute rectangle coords in local reference system
    vec3 d = s - o;
    squad.z0 = dot(d, squad.z);

    // flip ’z’ to make it point against ’Q’
    if (squad.z0 > 0.0)
    {
        squad.z  *= -1.0;
        squad.z0 *= -1.0;
    }

    squad.z0sq = squad.z0 * squad.z0;
    squad.x0 = dot(d, squad.x);
    squad.y0 = dot(d, squad.y);
    squad.x1 = squad.x0 + exl;
    squad.y1 = squad.y0 + eyl;
    squad.y0sq = squad.y0 * squad.y0;
    squad.y1sq = squad.y1 * squad.y1;

    // create vectors to four vertices
    vec3 v00 = vec3(squad.x0, squad.y0, squad.z0);
    vec3 v01 = vec3(squad.x0, squad.y1, squad.z0);
    vec3 v10 = vec3(squad.x1, squad.y0, squad.z0);
    vec3 v11 = vec3(squad.x1, squad.y1, squad.z0);

    // compute normals to edges
    vec3 n0 = normalize(cross(v00, v10));
    vec3 n1 = normalize(cross(v10, v11));
    vec3 n2 = normalize(cross(v11, v01));
    vec3 n3 = normalize(cross(v01, v00));

    // compute internal angles (gamma_i)
    float g0 = acos(-dot(n0, n1));
    float g1 = acos(-dot(n1, n2));
    float g2 = acos(-dot(n2, n3));
    float g3 = acos(-dot(n3, n0));

    // compute predefined constants
    squad.b0 = n0.z;
    squad.b1 = n2.z;
    squad.b0sq = squad.b0 * squad.b0;
    squad.k = 2.0*pi_0 - g2 - g3;

    // compute solid angle from internal angles
    squad.S = g0 + g1 - squad.k;

    return squad;
}

vec3 SphQuadSample(SphQuad squad, float u, float v)
{
    // 1. compute 'cu'
    float au = u * squad.S + squad.k;
    float fu = (cos(au) * squad.b0 - squad.b1) / sin(au);
    float cu = 1.0 / sqrt(fu*fu + squad.b0sq) * (fu > 0.0 ? 1.0 : -1.0);
    cu = clamp(cu, -1.0, 1.0); // avoid NaNs

    // 2. compute 'xu'
    float xu = -(cu * squad.z0) / sqrt(1.0 - cu * cu);
    xu = clamp(xu, squad.x0, squad.x1); // avoid Infs

    // 3. compute 'yv'
    float d = sqrt(xu * xu + squad.z0sq);
    float h0 = squad.y0 / sqrt(d*d + squad.y0sq);
    float h1 = squad.y1 / sqrt(d*d + squad.y1sq);
    float hv = h0 + v * (h1 - h0), hv2 = hv * hv;
    float yv = (hv2 < 1.0 - 1e-6) ? (hv * d) / sqrt(1.0 - hv2) : squad.y1;

    // 4. transform (xu, yv, z0) to world coords
    return squad.o + xu*squad.x + yv*squad.y + squad.z0*squad.z;
}

// Sample generation
////////////////////

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

void Halton2D(out vec2 s[NUM_SAMPLES_3020430251], int offset)
{
    for (int i = 0; i < NUM_SAMPLES_3020430251; i++)
    {
        s[i].x = Halton(i + offset, 2.0);
        s[i].y = Halton(i + offset, 3.0);
    }
}

// Linearly Transformed Cosines
///////////////////////////////

float IntegrateEdge(vec3 v1, vec3 v2)
{
    float cosTheta = dot(v1, v2);
    cosTheta = clamp(cosTheta, -0.9999, 0.9999);

    float theta = acos(cosTheta);
    float res = cross(v1, v2).z * theta / sin(theta);

    return res;
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

vec3 LTC_Evaluate_3020430251(
    vec3 N, vec3 V, vec3 P, mat3 Minv, vec3 points[4], bool twoSided)
{
    // construct orthonormal basis around N
    vec3 T1, T2;
    T1 = normalize(V - N*dot(V, N));
    T2 = cross(N, T1);

    // rotate area light in (T1, T2, R) basis
    Minv = Minv * transpose(mat3(T1, T2, N));

    // polygon (allocate 5 vertices for clipping)
    vec3 L[5];
    L[0] = Minv * (points[0] - P);
    L[1] = Minv * (points[1] - P);
    L[2] = Minv * (points[2] - P);
    L[3] = Minv * (points[3] - P);

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
    float sum = 0.0;

    sum += IntegrateEdge(L[0], L[1]);
    sum += IntegrateEdge(L[1], L[2]);
    sum += IntegrateEdge(L[2], L[3]);
    if (n >= 4)
        sum += IntegrateEdge(L[3], L[4]);
    if (n == 5)
        sum += IntegrateEdge(L[4], L[0]);

    sum = twoSided ? abs(sum) : max(0.0, -sum);

    vec3 Lo_i = vec3(sum, sum, sum);

    return Lo_i;
}

// Misc. helpers
////////////////

vec3 PowVec3(vec3 v, float p)
{
    return vec3(pow(v.x, p), pow(v.y, p), pow(v.z, p));
}

vec3 check(bool test) {
    if (test) return vec3(0,1,0);
    else return vec3(1,0.2,0);
}

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

vec3 evalAreaLight(AreaLight light, vec3 posWorld, vec3 normalWorld, vec3 diffuseColor, vec3 specularColor, float roughness)
{
    vec2 seq[NUM_SAMPLES_3020430251];
    Halton2D(seq, sampleCount);

    vec3 col = vec3(0);

    // Scene info

    vec3 lcol = toLinear(light.color.rgb) * light.intensity;
    vec3 dcol = diffuseColor;
    vec3 scol = specularColor;
    {
        Ray ray;
        ray.origin = uCameraPosition;
        ray.dir = normalize(posWorld - uCameraPosition);
        {
            vec3 pos = posWorld;

            vec3 N = normalWorld;
            vec3 V = -ray.dir;

            //FIXME: why this has to be -1?
            vec3 ex = multQuat(vec3(-1, 0, 0), light.rotation)*light.size.x;
            vec3 ey = multQuat(vec3(0, 1, 0), light.rotation)*light.size.y;

            vec3 p1 = light.position - ex + ey;
            vec3 p2 = light.position + ex + ey;
            vec3 p3 = light.position + ex - ey;
            vec3 p4 = light.position - ex - ey;

            vec3 points[4];
            points[0] = p1;
            points[1] = p2;
            points[2] = p3;
            points[3] = p4;

            float theta = acos(dot(N, V));
            vec2 uv = vec2(roughness, theta/(0.5*pi_0));
            uv = uv*LUT_SCALE_3020430251 + LUT_BIAS_3020430251;

            vec4 t = texture2D(ltc_mat, uv);
            mat3 Minv = mat3(
                vec3(  1,   0, t.y),
                vec3(  0, t.z,   0),
                vec3(t.w,   0, t.x)
            );

            vec3 spec = lcol*scol*LTC_Evaluate_3020430251(N, V, pos, Minv, points, false);
            spec *= texture2D(ltc_mag, uv).w;

            vec3 diff = lcol*dcol*LTC_Evaluate_3020430251(N, V, pos, mat3(1), points, false);

            col  = spec + diff;
            col /= 2.0*pi_0;
        }

        //TODO: how to find out we had hit the screen?
        //float distToRect;
        //if (RayRectIntersect(ray, rect, distToRect))
        //    if ((distToRect < distToFloor) || !hitFloor)
        //        col = lcol;
    }

    return col;
}


void EvaluateAreaLight(inout PBRData data, AreaLight light, int i) {
  data.indirectSpecular += evalAreaLight(light, data.positionWorld, data.normalWorld, data.baseColor, data.specularColor, data.roughness);
}
#endif



uniform sampler2D uReflectionMap;
uniform int uReflectionMapEncoding;

vec3 getIrradiance(vec3 eyeDirWorld, vec3 normalWorld) {
  vec2 uv = envMapOctahedral(normalWorld);
  float width = 2048.0;
  float irrSize = 64.0;
  uv += 0.5 / irrSize;
  uv /= irrSize / (irrSize - 1.0);
  uv = (uv * irrSize + vec2(2048.0 - irrSize)) / width;
  return decode(texture2D(uReflectionMap, uv), uReflectionMapEncoding).rgb;
}

vec3 EnvBRDFApprox( vec3 SpecularColor, float Roughness, float NoV ) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022 );
  const vec4 c1 = vec4( 1.0, 0.0425, 1.04, -0.04 );
  vec4 r = Roughness * c0 + c1;
  float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
  vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
  return SpecularColor * AB.x + AB.y;
}

vec3 getPrefilteredReflection(vec3 eyeDirWorld, vec3 normalWorld, float roughness) {
  float maxMipMapLevel = 5.0; //TODO: const
  vec3 reflectionWorld = reflect(-eyeDirWorld, normalWorld);
  //float lod = pow(roughness, 2.0) * maxMipMapLevel; //TODO: verify reflection probe blurring code
  float lod = pow(roughness, 1.5) * maxMipMapLevel;
  float upLod = floor(lod);
  float downLod = ceil(lod);
  vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, upLod)), uReflectionMapEncoding).rgb;
  vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, downLod)), uReflectionMapEncoding).rgb;
  return mix(a, b, lod - upLod);
}

void EvaluateLightProbe(inout PBRData data) {
  float NdotV = clamp( dot( data.normalWorld, data.eyeDirWorld ), 0.0, 1.0);
  vec3 reflectance = EnvBRDFApprox( data.specularColor, data.roughness, NdotV ); //TODO: roughness or alphaRoughness
  //No need to multiply by PI like three.jss as I'm already multiplying by PI in my convolution code
  vec3 irradianceColor = getIrradiance(data.eyeDirWorld, data.normalWorld);
  vec3 reflectionColor = getPrefilteredReflection(data.eyeDirWorld, data.normalWorld, data.roughness);  //TODO: roughness or alphaRoughness
  data.indirectDiffuse += data.diffuseColor * irradianceColor;
  data.indirectSpecular += reflectionColor * reflectance;
}



#ifdef USE_NORMAL_MAP
uniform sampler2D uNormalMap;
uniform float uNormalScale;

//http://www.thetenthplanet.de/archives/1180
mat3 cotangentFrame(vec3 N, vec3 p, vec2 uv) {
  // get edge vectors of the pixel triangle
  vec3 dp1 = dFdx(p);
  vec3 dp2 = dFdy(p);
  vec2 duv1 = dFdx(uv);
  vec2 duv2 = dFdy(uv);

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

void getNormal(inout PBRData data) {
  vec3 normalRGB = texture2D(uNormalMap, data.texCoord0).rgb;
  vec3 normalMap = normalRGB * 2.0 - 1.0;
  normalMap.y *= uNormalScale;
  normalMap = normalize(normalMap);

  vec3 N = normalize(data.normalView);
  vec3 V = normalize(data.eyeDirView);

  vec3 normalView;
  #ifdef USE_TANGENTS
    vec3 bitangent = cross(N, data.tangentView.xyz) * sign(data.tangentView.w);
    mat3 TBN = mat3(data.tangentView.xyz, bitangent, N);
    normalView = normalize(TBN * normalMap);
  #else
    //make the output normalView match glTF expected right handed orientation
    normalMap.y *= -1.0;
    normalView = perturb(normalMap, N, V, data.texCoord0);
  #endif

  vec3 normalWorld = vec3(data.inverseViewMatrix * vec4(normalView, 0.0));
  data.normalWorld = normalize(normalWorld);
}
#endif

// FIXME: why i can't do #elseif
/*
#ifdef USE_DISPLACEMENT_MAP
uniform sampler2D uDisplacementMap;
uniform float uDisplacement;
uniform float uDisplacementNormalScale;
vec3 getNormal() {
  float scale = uDisplacement * uDisplacementNormalScale;
  float h = scale * texture2D(uDisplacementMap, vTexCoord0).r;
  float hx = scale * texture2D(uDisplacementMap, vTexCoord0 + vec2(1.0 / 2048.0, 0.0)).r;
  float hz = scale * texture2D(uDisplacementMap, vTexCoord0 + vec2(0.0, 1.0 / 2048.0)).r;
  float meshSize = 20.0;
  vec3 a = vec3(0.0, h, 0.0);
  vec3 b = vec3(1.0 / 2048.0 * meshSize, hx, 0.0);
  vec3 c = vec3(0.0, hz, 1.0 / 2048.0 * meshSize);
  vec3 N = normalize(cross(normalize(c - a), normalize(b - a)));
  // FIXME: this is model space normal, need to multiply by modelWorld
  // N = mat3(uModelMatrix) * N;
  return N;
}
#else
*/
#ifndef USE_NORMAL_MAP
void getNormal(inout PBRData data) {
  // NOP
}
#endif
//#endif
//end of USE_DISPLACEMENT_MAP




#ifdef USE_EMISSIVE_COLOR_MAP
    uniform vec4 uEmissiveColor; // TODO: gltf assumes sRGB color, not linear
    uniform sampler2D uEmissiveColorMap; //assumes sRGB color, not linear
    uniform float uEmissiveIntensity;
    void getEmissiveColor(inout PBRData data) {
      data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb * decode(texture2D(uEmissiveColorMap, vTexCoord0), 3).rgb;
    }
#else
    uniform vec4 uEmissiveColor; //assumes sRGB color, not linear
    uniform float uEmissiveIntensity;
    void getEmissiveColor(inout PBRData data) {
      data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb;
    }
#endif


#ifdef USE_OCCLUSION_MAP
uniform sampler2D uOcclusionMap;
#endif
#endif


#ifdef USE_BASE_COLOR_MAP
uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear
uniform sampler2D uBaseColorMap; //assumes sRGB color, not linear
void getBaseColor (inout PBRData data) {
  vec4 texelColor = texture2D(uBaseColorMap, data.texCoord0);

  data.baseColor = decode(uBaseColor, 3).rgb * decode(texelColor, 3).rgb;
  data.opacity = uBaseColor.a * texelColor.a;
}
#else
uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear
void getBaseColor (inout PBRData data) {
  data.baseColor = decode(uBaseColor, 3).rgb;
  data.opacity = uBaseColor.a;
}
#endif


#ifdef USE_METALLIC_ROUGHNESS_WORKFLOW


#ifdef USE_METALLIC_ROUGHNESS_MAP
  // R = ?, G = roughness, B = metallic
  uniform sampler2D uMetallicRoughnessMap;
  // TODO: sampling the same texture twice
  void getMetallic(inout PBRData data) {
    vec4 texelColor = texture2D(uMetallicRoughnessMap, vTexCoord0);
    data.metallic = texelColor.b;
    data.roughness = texelColor.g;
  }
  void getRoughness(inout PBRData data) {
    //NOP, already read in getMetallic
  }

#else
  #ifdef USE_METALLIC_MAP
    uniform sampler2D uMetallicMap; //assumes linear, TODO: check gltf
    uniform float uMetallic;
    void getMetallic(inout PBRData data) {
      data.metallic = uMetallic * texture2D(uMetallicMap, vTexCoord0).r;
    }
  #else
    uniform float uMetallic;
    void getMetallic(inout PBRData data) {
      data.metallic = uMetallic;
    }
  #endif

  #ifdef USE_ROUGHNESS_MAP
    uniform float uRoughness;
    uniform sampler2D uRoughnessMap; //assumes linear, TODO: check glTF
    void getRoughness(inout PBRData data) {
      data.roughness = uRoughness * texture2D(uRoughnessMap, vTexCoord0).r + 0.01;
    }
  #else
    uniform float uRoughness;
    void getRoughness(inout PBRData data) {
      data.roughness = uRoughness + 0.01;
    }
  #endif
#endif
//end of USE_METALLIC_ROUGHNESS_MAP

#endif

#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW

#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW
uniform vec4 uDiffuse;
uniform vec3 uSpecular;
uniform float uGlossiness;

#ifdef USE_DIFFUSE_MAP
    uniform sampler2D uDiffuseMap;
    uniform float uDiffuseMapEncoding;
    vec4 getDiffuse() {
      // assumes sRGB texture
      vec4 texelColor = texture2D(uDiffuseMap, vTexCoord0);
      return vec4(decode(uDiffuse, 3).rgb, uDiffuse.a) * vec4(decode(texelColor, 3).rgb, texelColor.a);
    }
#else
    vec4 getDiffuse() {
      return vec4(decode(uDiffuse, 3).rgb, uDiffuse.a);
    }
//USE_DIFFUSE_MAP
#endif

#ifdef USE_SPECULAR_GLOSSINESS_MAP
    uniform sampler2D uSpecularGlossinessMap;
    vec4 getSpecularGlossiness() {
      // assumes specular is sRGB and glossiness is linear
      vec4 specGloss = texture2D(uSpecularGlossinessMap, vTexCoord0);
      //TODO: should i move uSpecular to linear?
      return vec4(uSpecular, uGlossiness) * vec4(decode(vec4(specGloss.rgb, 1.0), 3).rgb, specGloss.a);
    }
#else
    vec4 getSpecularGlossiness() {
      return vec4(uSpecular, uGlossiness);
    }
//USE_SPECULAR_GLOSSINES_MAP
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
  return clamp((-b + sqrt(D)) / (2.0 * a), 0.0, 1.0);
}

//USE_SPECULAR_GLOSSINESS_WORKFLOW
#endif

#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW

void getBaseColorAndMetallicRoughnessFromSpecularGlossines(inout PBRData data) {
    vec4 specularGlossiness = getSpecularGlossiness();

    vec3 specular = specularGlossiness.rgb;
    data.specularColor = specular;

    float glossiness = specularGlossiness.a;
    data.roughness = 1.0 - glossiness;

    vec4 diffuseRGBA = getDiffuse();
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
}
#else
#endif

#endif

void main() {
  PBRData data;
  data.texCoord0 = vTexCoord0;
#ifdef USE_UNLIT_WORKFLOW
  getBaseColor(data);
  vec3 color = data.baseColor;
  #ifdef USE_VERTEX_COLORS
    vec3 tint = decode(vColor, 3).rgb;
    color*= tint;
  #endif
// !USE_USE_UNLIT_WORKFLOW
#else
    data.inverseViewMatrix = uInverseViewMatrix;
    data.positionWorld = vPositionWorld;
    data.positionView = vPositionView;
    data.normalView = normalize(vNormalView); //TODO: normalization needed?
    #ifdef USE_TANGENTS
      data.tangentView = normalize(vTangentView);
    #endif
    data.normalView *= float(gl_FrontFacing) * 2.0 - 1.0;
    data.normalWorld = normalize(vNormalWorld);
    data.normalWorld *= float(gl_FrontFacing) * 2.0 - 1.0;
    data.eyeDirView = normalize(-vPositionView); //TODO: normalization needed?
    data.eyeDirWorld = vec3(uInverseViewMatrix * vec4(data.eyeDirView, 0.0));
    data.indirectDiffuse = vec3(0.0);
    data.indirectSpecular = vec3(0.0);
    data.directDiffuse = vec3(0.0);
    data.directSpecular = vec3(0.0);
    data.opacity = 1.0;

    getNormal(data);
    getEmissiveColor(data);
    vec3 F0 = vec3(0.04);

#ifdef USE_METALLIC_ROUGHNESS_WORKFLOW
    getBaseColor(data);
    getRoughness(data);
    // TODO: avoid disappearing highlights at roughness 0
    data.roughness = 0.004 + 0.996 * data.roughness;
    getMetallic(data);

    // http://www.codinglabs.net/article_physically_based_rendering_cook_torrance.aspx
    data.diffuseColor = data.baseColor * (1.0 - F0) * (1.0 - data.metallic);
    data.specularColor = mix(F0, data.baseColor, data.metallic);
#endif
#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW
    getBaseColorAndMetallicRoughnessFromSpecularGlossines(data);
    // TODO: verify we don't need to multiply by 1 - metallic like above
    data.diffuseColor = data.baseColor;
#endif

#ifdef USE_ALPHA_MAP
  data.opacity *= texture2D(uAlphaMap, data.texCoord0).r;
#endif
#ifdef USE_ALPHA_TEST
  AlphaTest(data);
#endif

#ifdef USE_VERTEX_COLORS
    vec3 tint = decode(vColor, 3).rgb;
    data.diffuseColor *= tint;
    data.specularColor *= tint;
#endif

#ifdef USE_INSTANCED_COLOR
    vec3 tint = decode(vColor, 3).rgb;
    data.diffuseColor *= tint;
    data.specularColor *= tint;
#endif

    data.alphaRoughness = data.roughness * data.roughness;

    // view vector in world space
    data.viewWorld = normalize(uCameraPosition - vPositionWorld);

    vec3 N = data.normalWorld;
    vec3 V = data.viewWorld;

    data.NdotV = clamp(dot(N, V), 0.001, 1.0);

    float ao = 1.0;
#ifdef USE_OCCLUSION_MAP
    ao *= texture2D(uOcclusionMap, vTexCoord0).r;
#endif
#ifdef USE_AO
    vec2 vUV = vec2(gl_FragCoord.x / uScreenSize.x, gl_FragCoord.y / uScreenSize.y);
    ao *= texture2D(uAO, vUV).r;
#endif

//TODO: No kd? so not really energy conserving
//we could use disney brdf for irradiance map to compensate for that like in Frostbite

#ifdef USE_REFLECTION_PROBES
  EvaluateLightProbe(data);
#endif

#if NUM_AMBIENT_LIGHTS > 0
  for(int i=0; i<NUM_AMBIENT_LIGHTS; i++) {
    AmbientLight light = uAmbientLights[i];
    EvaluateAmbientLight(data, light, i);
  }
#endif
#if NUM_DIRECTIONAL_LIGHTS > 0
  for(int i=0; i<NUM_DIRECTIONAL_LIGHTS; i++) {
    DirectionalLight light = uDirectionalLights[i];
    EvaluateDirectionalLight(data, light, i);
  }
#endif
#if NUM_POINT_LIGHTS > 0
  for(int i=0; i<NUM_POINT_LIGHTS; i++) {
    PointLight light = uPointLights[i];
    EvaluatePointLight(data, light, i);
  }
#endif
#if NUM_SPOT_LIGHTS > 0
  for(int i=0; i<NUM_SPOT_LIGHTS; i++) {
    SpotLight light = uSpotLights[i];
    EvaluateSpotLight(data, light, i);
  }
#endif
#if NUM_AREA_LIGHTS > 0
  for(int i=0; i<NUM_AREA_LIGHTS; i++) {
    AreaLight light = uAreaLights[i];
    EvaluateAreaLight(data, light, i);
  }
#endif
  vec3 color = data.emissiveColor + ao * data.indirectDiffuse + ao * data.indirectSpecular + data.directDiffuse + data.directSpecular;
#ifdef USE_TONEMAPPING
  color.rgb *= uExposure;
  color.rgb = tonemapUncharted2(color.rgb);
#endif // USE_TONEMAPPING
#endif // USE_USE_UNLIT_WORKFLOW
  gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);
#ifdef USE_DRAW_BUFFERS
  gl_FragData[1] = encode(vec4(data.emissiveColor, 1.0), uOutputEncoding);
#endif
  #ifdef USE_BLEND
  gl_FragData[0].a = data.opacity;
  #endif
}
`
