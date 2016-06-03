#ifdef GL_ES
precision highp float;
#endif

#ifdef GL_ES
  #extension GL_EXT_shader_texture_lod : require
  #extension GL_OES_standard_derivatives : require
  #extension GL_EXT_draw_buffers : require
  #define textureCubeLod textureCubeLodEXT
#else
  #extension GL_ARB_shader_texture_lod : require
#endif

#pragma glslify: envMapCube         = require(../local_modules/glsl-envmap-cubemap)
#pragma glslify: toGamma            = require(glsl-gamma/out)
#pragma glslify: toLinear           = require(glsl-gamma/in)

uniform float uIor;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;

varying vec2 vTexCoord0;

varying vec3 vPositionWorld;
varying vec3 vPositionView;
uniform mat4 uInverseViewMatrix;
uniform mat4 uViewMatrix;
uniform mat3 uNormalMatrix;
uniform mat4 uModelMatrix;

uniform vec3 uCameraPosition;


//sun
uniform vec3 uSunPosition;
uniform vec4 uSunColor;

#if NUM_DIRECTIONAL_LIGHTS > 0

struct DirectionalLight {
    vec3 position;
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

#endif


#if NUM_POINT_LIGHTS > 0

struct PointLight {
    vec3 position;
    vec4 color;
    float radius;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];

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

#endif

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

float PCF(sampler2D depths, vec2 size, vec2 uv, float compare, float near, float far){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare, near, far);
        }
    }
    return result/25.0;
}

float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

#ifdef USE_BASE_COLOR_MAP
    uniform sampler2D uBaseColorMap; //assumes sRGB color, not linear
    vec3 getBaseColor() {
        return toLinear(texture2D(uBaseColorMap, vTexCoord0).rgb);
    }
#else
    uniform vec4 uBaseColor; //assumes sRGB color, not linear
    vec3 getBaseColor() {
        return toLinear(uBaseColor.rgb);
    }
#endif

#ifdef USE_EMISSIVE_COLOR_MAP
    uniform sampler2D uEmissiveColorMap; //assumes sRGB color, not linear
    vec3 getEmissiveColor() {
        return toLinear(texture2D(uEmissiveColorMap, vTexCoord0).rgb);
    }
#else
    uniform vec4 uEmissiveColor; //assumes sRGB color, not linear
    vec3 getEmissiveColor() {
        return toLinear(uEmissiveColor.rgb);
    }
#endif

#ifdef USE_METALLIC_MAP
    uniform sampler2D uMetallicMap; //assumes linear
    float getMetallic() {
        return texture2D(uMetallicMap, vTexCoord0).r;
    }
#else
    uniform float uMetallic;
    float getMetallic() {
        return uMetallic;
    }
#endif

#ifdef USE_ROUGHNESS_MAP
    uniform sampler2D uRoughnessMap; //assumes sRGB color, not linear
    float getRoughness() {
        return texture2D(uRoughnessMap, vTexCoord0).r;
    }
#else
    uniform float uRoughness;
    float getRoughness() {
        return uRoughness;
    }
#endif

#ifdef USE_NORMAL_MAP
    uniform sampler2D uNormalMap;
    #pragma glslify: perturb = require('glsl-perturb-normal')
    vec3 getNormal() {
        vec3 normalRGB = texture2D(uNormalMap, vTexCoord0).rgb;
        vec3 normalMap = normalRGB * 2.0 - 1.0;

        //normalMap.y *= -1.0;
        /*normalMap.x *= -1.0;*/

        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vEyeDirView);

        vec3 normalView = perturb(normalMap, N, V, vTexCoord0);
        vec3 normalWorld = vec3(uInverseViewMatrix * vec4(normalView, 0.0));
        return normalWorld;

    }
#else
    vec3 getNormal() {
        return normalize(vNormalWorld);
    }
#endif

uniform samplerCube uReflectionMap;
uniform float uReflectionMapFlipEnvMap;
uniform samplerCube uIrradianceMap;
uniform float uIrradianceMapFlipEnvMap;

vec3 getIrradiance(vec3 eyeDirWorld, vec3 normalWorld) {
    vec3 R = envMapCube(normalWorld);
    return textureCube(uIrradianceMap, R).rgb;
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
    //vec3 R = envMapCube(data.normalWorld);
    vec3 R = envMapCube(reflectionWorld, uReflectionMapFlipEnvMap);
    float lod = roughness * maxMipMapLevel;
    float upLod = floor(lod);
    float downLod = ceil(lod);
    vec3 a = textureCubeLod(uReflectionMap, R, upLod).rgb;
    vec3 b = textureCubeLod(uReflectionMap, R, downLod).rgb;

    return mix(a, b, lod - upLod);
}

float G1V(float dotNV, float k) {
  return 1.0/(dotNV*(1.0-k)+k);
}

vec3 directSpecularGGX(vec3 N, vec3 V, vec3 L, float roughness, vec3 F0) {
  float alpha = roughness * roughness;

  //half vector
  vec3 H = normalize(V+L);

  float dotNL = clamp(dot(N,L), 0.0, 1.0);
  float dotNV = clamp(dot(N,V), 0.0, 1.0);
  float dotNH = clamp(dot(N,H), 0.0, 1.0);
  float dotLH = clamp(dot(L,H), 0.0, 1.0);

  //microfacet model

  // D - microfacet distribution function, shape of specular peak
  float alphaSqr = alpha*alpha;
  float pi = 3.14159;
  float denom = dotNH * dotNH * (alphaSqr-1.0) + 1.0;
  float D = alphaSqr/(pi * denom * denom);

  // F - fresnel reflection coefficient
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - dotLH, 5.0);

  // V / G - geometric attenuation or shadowing factor
  float k = alpha/2.0;
  float vis = G1V(dotNL,k)*G1V(dotNV,k);

  vec3 specular = dotNL * D * F * vis;
  return specular;
}

uniform sampler2D ltc_mat;
uniform sampler2D ltc_mag;

uniform mat4  view;
const vec2  resolution = vec2(1280.0, 720.0);
const int   sampleCount = 4;

const int   NUM_SAMPLES = 8;
const float LUT_SIZE  = 64.0;
const float LUT_SCALE = (LUT_SIZE - 1.0)/LUT_SIZE;
const float LUT_BIAS  = 0.5/LUT_SIZE;
const float pi = 3.14159265;

// See "Building an orthonormal basis from a 3d unit vector without normalization"
// Frisvad, Journal of Graphics Tools, 2012.
mat3 CreateBasis(vec3 v)
{
    vec3 x, y;

    if (v.z < -0.999999)
    {
        x = vec3( 0, -1, 0);
        y = vec3(-1,  0, 0);
    }
    else
    {
        float a = 1.0 / (1.0 + v.z);
        float b = -v.x*v.y*a;
        x = vec3(1.0 - v.x*v.x*a, b, -v.x);
        y = vec3(b, 1.0 - v.y*v.y*a, -v.y);
    }

    return mat3(x, y, v);
}

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
    squad.k = 2.0*pi - g2 - g3;

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

void Halton2D(out vec2 s[NUM_SAMPLES], int offset)
{
    for (int i = 0; i < NUM_SAMPLES; i++)
    {
        s[i].x = Halton(i + offset, 2.0);
        s[i].y = Halton(i + offset, 3.0);
    }
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


vec3 LTC_Evaluate(
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

#if NUM_AREA_LIGHTS > 0
vec3 evalAreaLight(AreaLight light, vec3 posWorld, vec3 normalWorld, vec3 diffuseColor, vec3 specularColor, float roughness)
{
    vec2 seq[NUM_SAMPLES];
    Halton2D(seq, sampleCount);

    vec3 col = vec3(0);

    // Scene info

    vec3 lcol = light.color.rgb * light.intensity;
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
            vec2 uv = vec2(roughness, theta/(0.5*pi));
            uv = uv*LUT_SCALE + LUT_BIAS;

            vec4 t = texture2D(ltc_mat, uv);
            mat3 Minv = mat3(
                vec3(  1,   0, t.y),
                vec3(  0, t.z,   0),
                vec3(t.w,   0, t.x)
            );

            vec3 spec = lcol*scol*LTC_Evaluate(N, V, pos, Minv, points, false);
            spec *= texture2D(ltc_mag, uv).w;

            vec3 diff = lcol*dcol*LTC_Evaluate(N, V, pos, mat3(1), points, false);

            col  = spec + diff;
            col /= 2.0*pi;
        }

        //TODO: how to find out we had hit the screen?
        //float distToRect;
        //if (RayRectIntersect(ray, rect, distToRect))
        //    if ((distToRect < distToFloor) || !hitFloor)
        //        col = lcol;
    }

    return col;
  }
#endif

void main() {
    vec3 normalWorld = getNormal();
    vec3 eyeDirWorld = normalize(vEyeDirWorld);

    vec3 baseColor = getBaseColor();
    vec3 emissiveColor = getEmissiveColor();
    float roughness = getRoughness();
    float metallic = getMetallic();

    vec3 F0 = vec3(abs((1.0 - uIor) / (1.0 + uIor)));
    F0 = F0 * F0; //0.04 is default for non-metals in UE4
    F0 = mix(F0, baseColor, metallic);


    vec3 diffuseColor = baseColor * (1.0 - metallic);
    vec3 specularColor = mix(vec3(1.0), baseColor, metallic);

    vec3 indirectDiffuse = vec3(0.0);
    vec3 indirectSpecular = vec3(0.0);
    vec3 directDiffuse = vec3(0.0);
    vec3 directSpecular = vec3(0.0);

    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
#ifdef USE_REFLECTION_PROBES
    float NdotV = saturate( dot( normalWorld, eyeDirWorld ) );
    vec3 reflectance = EnvBRDFApprox( F0, roughness, NdotV );
    vec3 irradianceColor = getIrradiance(eyeDirWorld, normalWorld);
    vec3 reflectionColor = getPrefilteredReflection(eyeDirWorld, normalWorld, roughness);
    indirectDiffuse = diffuseColor * irradianceColor;
    indirectSpecular = reflectionColor * specularColor * reflectance;

#endif

    //lights
#if NUM_DIRECTIONAL_LIGHTS > 0
    for(int i=0; i<NUM_DIRECTIONAL_LIGHTS; i++) {
        DirectionalLight light = uDirectionalLights[i];

        vec3 L = normalize(-light.direction);

        float dotNL = max(0.0, dot(normalWorld, L));

        //shadows
        vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0);
        float lightDistView = -lightViewPosition.z;
        vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
        vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
        float lightDeviceCoordsZ = lightDeviceCoordsPosition.z / lightDeviceCoordsPosition.w;
        vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

#ifdef SHADOW_QUALITY_0
        float illuminated = 1.0;
#elseif SHADOW_QUALITY_1
        float illuminated = texture2DCompare(uDirectionalLightShadowMaps[i], lightUV, lightDistView - uBias, light.near, light.far);
#elseif SHADOW_QUALITY_2
        float illuminated = texture2DShadowLerp(uDirectionalLightShadowMaps[i], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#else
        float illuminated = PCF(uDirectionalLightShadowMaps[i], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif
        if (illuminated > 0.0) {
            //TODO: specular light conservation
            directDiffuse += diffuseColor * dotNL * light.color.rgb * illuminated;
            directSpecular += directSpecularGGX(normalWorld, eyeDirWorld, L, roughness, F0) * illuminated;
        }
    }
#endif

#if NUM_POINT_LIGHTS > 0
    for(int i=0; i<NUM_POINT_LIGHTS; i++) {
        PointLight light = uPointLights[i];

        vec3 L = light.position - vPositionWorld;
        float dist = length(L);
        L /= dist;

        float dotNL = max(0.0, dot(normalWorld, L));

        float distanceRatio = clamp(1.0 - pow(dist/light.radius, 4.0), 0.0, 1.0);
        float falloff = (distanceRatio * distanceRatio) / (dist * dist + 1.0);

        //TODO: specular light conservation
        directDiffuse += diffuseColor * dotNL * light.color.rgb * falloff;
        directSpecular += directSpecularGGX(normalWorld, eyeDirWorld, L, roughness, F0) * light.color.rgb * falloff;
    }
#endif

    vec3 indirectArea = vec3(0.0);

#if NUM_AREA_LIGHTS > 0
    for(int i=0; i<NUM_AREA_LIGHTS; i++) {
        AreaLight light = uAreaLights[i];

        //if (length(emissiveColor) == 0.0) {
            indirectArea += evalAreaLight(light, vPositionWorld, normalWorld, diffuseColor, specularColor, roughness); //TEMP: fix roughness
            //indirectArea = evalAreaLight(light, vPositionWorld, normalWorld,roughness); //TEMP: fix roughness
            /*indirectArea = evalAreaLight(light, vPositionView, (uNormalMatrix*normalWorld).xyz, diffuseColor, specularColor, roughness); //TEMP: fix roughness*/
        //}
    }
#endif

    vec3 color = emissiveColor + indirectDiffuse + indirectSpecular + directDiffuse + directSpecular + indirectArea;
    /*vec3 color = indirectArea;*/
    //color = emissiveColor + indirectArea;
    /*color.r = 1.0;*/
    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalView * 0.5 + 0.5, 1.0);
}
