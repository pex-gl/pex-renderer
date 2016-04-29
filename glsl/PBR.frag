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

#ifndef PI
#define PI 3.1415926
#endif

#ifndef TwoPI
#define TwoPI (2.0 * PI)
#endif

/**
 * Samples equirectangular (lat/long) panorama environment map
 * @param  {sampler2D} envMap - equirectangular (lat/long) panorama texture
 * @param  {vec3} wcNormal - normal in the world coordinate space
 * @param  {float} - flipEnvMap    -1.0 for left handed coorinate system oriented texture (usual case)
 *                                  1.0 for right handed coorinate system oriented texture
 * @return {vec2} equirectangular texture coordinate-
 * @description Based on http://http.developer.nvidia.com/GPUGems/gpugems_ch17.html and http://gl.ict.usc.edu/Data/HighResProbes/
 */
vec2 envMapEquirect(vec3 wcNormal, float flipEnvMap) {
  //I assume envMap texture has been flipped the WebGL way (pixel 0,0 is a the bottom)
  //therefore we flip wcNorma.y as acos(1) = 0
  float phi = acos(-wcNormal.y);
  float theta = atan(flipEnvMap * wcNormal.x, wcNormal.z) + PI;
  return vec2(theta / TwoPI, phi / PI);
}

vec2 envMapEquirect(vec3 wcNormal) {
    //-1.0 for left handed coordinate system oriented texture (usual case)
    return envMapEquirect(wcNormal, -1.0);
}

/**
 * Samples cubemap environment map
 * @param  {vec3} wcNormal - normal in the world coordinate space
 * @param  {float} - flipEnvMap    -1.0 for left handed coorinate system oriented texture (usual case)
 *                                  1.0 for right handed coorinate system oriented texture
 * @return {vec4} - cubemap texture coordinate
 */
vec3 envMapCubemap(vec3 wcNormal, float flipEnvMap) {
    return vec3(flipEnvMap * wcNormal.x, wcNormal.y, wcNormal.z);
}

vec3 envMapCubemap(vec3 wcNormal) {
    //-1.0 for left handed coorinate system oriented texture (usual case)
    return envMapCubemap(wcNormal, -1.0);
}

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

#ifdef GL_ES
precision highp float;
#define GLSLIFY 1
#endif

/*

Based on "A Practical Analytic Model for Daylight"
aka The Preetham Model, the de facto standard analytic skydome model
http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf

First implemented by Simon Wallner http://www.simonwallner.at/projects/atmospheric-scattering

Improved by Martin Upitis http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR

Three.js integration by zz85 http://twitter.com/blurspline

Plask / Pex integration by Marcin Ignac http://twitter.com/marcinignac, 2015-09
*/

vec3 cameraPos = vec3(0.0, 0.0, 0.0);

const float luminance = 1.0;
const float turbidity = 10.0;
const float reileigh = 2.0;
const float mieCoefficient = 0.005;
const float mieDirectionalG = 0.8;

//uniform float luminance; //1.0
//uniform float turbidity; //10.0
//uniform float reileigh; //2.0
//uniform float mieCoefficient; //0.005
//uniform float mieDirectionalG; //0.8

float reileighCoefficient = reileigh;

// constants for atmospheric scattering
const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi_0 = 3.141592653589793238462643383279502884197169;

const float n = 1.0003; // refractive index of air
const float N_0 = 2.545E25; // number of molecules per unit volume for air at
// 288.15K and 1013mb (sea level -45 celsius)
const float pn = 0.035; // depolatization factor for standard air

// wavelength of used primaries, according to preetham
const vec3 lambda_0 = vec3(680E-9, 550E-9, 450E-9);

// mie stuff
// K coefficient for the primaries
const vec3 K_0 = vec3(0.686, 0.678, 0.666);
const float v_0 = 4.0;

// optical length at zenith for molecules
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
const vec3 up = vec3(0.0, 1.0, 0.0);

const float EE = 1000.0;
const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
// 66 arc seconds -> degrees, and the cosine of that

// earth shadow hack
const float cutoffAngle = pi_0/1.95;
const float steepness = 1.5;

vec3 totalRayleigh(vec3 lambda)
{
    return (8.0 * pow(pi_0, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N_0 * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));
}

// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE
vec3 simplifiedRayleigh()
{
    return 0.0005 / vec3(94, 40, 18);
}

float rayleighPhase(float cosTheta)
{
    return (3.0 / (16.0*pi_0)) * (1.0 + pow(cosTheta, 2.0));
    // return (1.0 / (3.0*pi)) * (1.0 + pow(cosTheta, 2.0));
    // return (3.0 / 4.0) * (1.0 + pow(cosTheta, 2.0));
}

vec3 totalMie(vec3 lambda, vec3 K, float T)
{
    float c = (0.2 * T ) * 10E-18;
    return 0.434 * c * pi_0 * pow((2.0 * pi_0) / lambda, vec3(v_0 - 2.0)) * K;
}

float hgPhase(float cosTheta, float g)
{
    return (1.0 / (4.0*pi_0)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0*g*cosTheta + pow(g, 2.0), 1.5));
}

float sunIntensity(float zenithAngleCos)
{
    return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos))/steepness)));
}

// float logLuminance(vec3 c)
// {
// return log(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);
// }

// Filmic ToneMapping http://filmicgames.com/archives/75
float A = 0.15;
float B_0 = 0.50;
float C = 0.10;
float D_0 = 0.20;
float E = 0.02;
float F_0 = 0.30;
float W = 1000.0;

vec3 Uncharted2Tonemap(vec3 x)
{
    return ((x*(A*x+C*B_0)+D_0*E)/(x*(A*x+B_0)+D_0*F_0))-E/F_0;
}

vec3 sky(vec3 sunPosition, vec3 worldNormal) {
    vec3 sunDirection = normalize(sunPosition);
    float sunfade = 1.0-clamp(1.0-exp((sunPosition.y/450000.0)),0.0,1.0);

    // luminance = 1.0 ;// vWorldPosition.y / 450000. + 0.5; //sunPosition.y / 450000. * 1. + 0.5;

    // gl_FragColor = vec4(sunfade, sunfade, sunfade, 1.0);

    reileighCoefficient = reileighCoefficient - (1.0* (1.0-sunfade));

    float sunE = sunIntensity(dot(sunDirection, up));

    // extinction (absorbtion + out scattering)
    // rayleigh coefficients
    //vec3 betaR = totalRayleigh(lambda) * reileighCoefficient;
    vec3 betaR = simplifiedRayleigh() * reileighCoefficient;

    // mie coefficients
    vec3 betaM = totalMie(lambda_0, K_0, turbidity) * mieCoefficient;

    // optical length
    // cutoff angle at 90 to avoid singularity in next formula.
    //float zenithAngle = acos(max(0.0, dot(up, normalize(vWorldPosition - cameraPos))));
    float zenithAngle = acos(max(0.0, dot(up, normalize(worldNormal))));
    float sR = rayleighZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi_0), -1.253));
    float sM = mieZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi_0), -1.253));

    // combined extinction factor
    vec3 Fex = exp(-(betaR * sR + betaM * sM));

    // in scattering
    float cosTheta = dot(normalize(worldNormal), sunDirection);

    float rPhase = rayleighPhase(cosTheta*0.5+0.5);
    vec3 betaRTheta = betaR * rPhase;

    float mPhase = hgPhase(cosTheta, mieDirectionalG);
    vec3 betaMTheta = betaM * mPhase;

    vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex),vec3(1.5));
    Lin *= mix(vec3(1.0),pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex,vec3(1.0/2.0)),clamp(pow(1.0-dot(up, sunDirection),5.0),0.0,1.0));

    //nightsky
    vec3 direction = normalize(worldNormal);
    float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]
    float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]
    vec2 uv = vec2(phi, theta) / vec2(2.0*pi_0, pi_0) + vec2(0.5, 0.0);
    // vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;
    vec3 L0 = vec3(0.1) * Fex;

    // composition + solar disc
    //if (cosTheta > sunAngularDiameterCos)
    float sundisk = smoothstep(sunAngularDiameterCos,sunAngularDiameterCos+0.00002,cosTheta);
    // if (normalize(vWorldPosition - cameraPos).y>0.0)
    L0 += (sunE * 19000.0 * Fex)*sundisk;

    vec3 whiteScale = 1.0/Uncharted2Tonemap(vec3(W));

    vec3 texColor = (Lin+L0);
    texColor *= 0.04 ;
    texColor += vec3(0.0,0.001,0.0025)*0.3;

    float g_fMaxLuminance = 1.0;
    float fLumScaled = 0.1 / luminance;
    float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled);

    float ExposureBias = fLumCompressed;

    vec3 curr = Uncharted2Tonemap((log2(2.0/pow(luminance,4.0)))*texColor);
    //vec3 curr = texColor;
    vec3 color = curr*whiteScale;

    vec3 retColor = pow(color,vec3(1.0/(1.2+(1.2*sunfade))));

    //VRG hack
    retColor = pow(retColor, vec3(2.2));
    return retColor;
}

float random(vec2 co)
{
   return fract(sin(dot(co.xy,vec2(12.9898,78.233))) * 43758.5453);
}

uniform float uIor;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;

varying vec2 vTexCoord0;

varying vec3 vPositionWorld;
uniform mat4 uInverseViewMatrix;

//sun
uniform vec3 uSunPosition;

//shadow mapping
uniform mat4 uLightProjectionMatrix;
uniform mat4 uLightViewMatrix;
uniform float uLightNear;
uniform float uLightFar;
uniform sampler2D uShadowMap;
uniform vec2 uShadowMapSize;
uniform float uShadowQuality;
uniform float uBias;

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToEyeSpaceProj(float ndcDepth) {
    /*return ((ndcDepth + (uLightFar + uLightNear)/(uLightFar - uLightNear)) * (uLightFar - uLightNear))/2.0;*/
    return 2.0 * uLightNear * uLightFar / (uLightFar + uLightNear - ndcDepth * (uLightFar - uLightNear));
}

//otho
//z = (f - n) * (zn + (f + n)/(f-n))/2
//http://www.ogldev.org/www/tutorial47/tutorial47.html
float ndcDepthToEyeSpace(float ndcDepth) {
    return (uLightFar - uLightNear) * (ndcDepth + (uLightFar + uLightNear) / (uLightFar - uLightNear)) / 2.0;
}

float readDepth(sampler2D depthMap, vec2 coord) {
    float z_b = texture2D(depthMap, coord).r;
    float z_n = 2.0 * z_b - 1.0;
    return ndcDepthToEyeSpace(z_n);
}

float texture2DCompare(sampler2D depthMap, vec2 uv, float compare) {
    float depth = readDepth(depthMap, uv);
    return step(compare, depth);
}

float texture2DShadowLerp(sampler2D depthMap, vec2 size, vec2 uv, float compare){
    vec2 texelSize = vec2(1.0)/size;
    vec2 f = fract(uv*size+0.5);
    vec2 centroidUV = floor(uv*size+0.5)/size;

    float lb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 0.0), compare);
    float lt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(0.0, 1.0), compare);
    float rb = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 0.0), compare);
    float rt = texture2DCompare(depthMap, centroidUV+texelSize*vec2(1.0, 1.0), compare);
    float a = mix(lb, lt, f.y);
    float b = mix(rb, rt, f.y);
    float c = mix(a, b, f.x);
    return c;
}

float PCF(sampler2D depths, vec2 size, vec2 uv, float compare){
    float result = 0.0;
    for(int x=-2; x<=2; x++){
        for(int y=-2; y<=2; y++){
            vec2 off = vec2(x,y)/float(size);
            result += texture2DShadowLerp(depths, size, uv+off, compare);
        }
    }
    return result/25.0;
}

float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

uniform sampler2D uAlbedoColorMap; //assumes sRGB color, not linear
vec3 getAlbedoColorMap() {
    return toLinear(texture2D(uAlbedoColorMap, vTexCoord0).rgb);
}
uniform vec4 uAlbedoColor; //assumes sRGB color, not linear
vec3 getAlbedoColor() {
    return toLinear(uAlbedoColor.rgb);
}
uniform bool uAlbedoColorMapEnabled;
vec3 getAlbedo() {
    if (uAlbedoColorMapEnabled) return getAlbedoColorMap();
    else return getAlbedoColor();
}
uniform sampler2D uRoughnessMap; //assumes sRGB color, not linear
uniform bool uRoughnessMapEnabled; //assumes sRGB color, not linear
float getRoughnessMap() {
    return texture2D(uRoughnessMap, vTexCoord0).r;//FIXME: changed to 1- for glssines textures
}
uniform float uRoughness;
float getRoughness() {
    if (uRoughnessMapEnabled) return getRoughnessMap();
    return uRoughness;
}

uniform sampler2D uMetalnessMap; //assumes sRGB color, not linear
uniform bool uMetalnessMapEnabled;
float getMetalnessMap() {
    return toLinear(texture2D(uMetalnessMap, vTexCoord0).r);
}
uniform float uMetalness;
float getMetalness() {
    if (uMetalnessMapEnabled) return getMetalnessMap();
    return uMetalness;
}
uniform sampler2D uNormalMap;
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
  return mat3(T * invmax, B * invmax, N);
}

vec3 perturb(vec3 map, vec3 N, vec3 V, vec2 texcoord) {
  mat3 TBN = cotangentFrame(N, -V, texcoord);
  return normalize(TBN * map);
}

vec3 getNormalMap() {
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
uniform bool uNormalMapEnabled;
vec3 getNormal() {
    if (uNormalMapEnabled) return normalize(getNormalMap());
    return normalize(vNormalWorld);
}

uniform samplerCube uReflectionMap;
uniform samplerCube uIrradianceMap;

vec3 getIrradiance(vec3 eyeDirWorld, vec3 normalWorld) {
    vec3 R = envMapCubemap(normalWorld);
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
    vec3 R = envMapCubemap(reflectionWorld);
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

  float D, vis;
  vec3 F;
  //microfacet model

  // D - microfacet distribution function, shape of specular peak
  float alphaSqr = alpha*alpha;
  float pi = 3.14159;
  float denom = dotNH * dotNH * (alphaSqr-1.0) + 1.0;
  D = alphaSqr/(pi * denom * denom);

  // F - fresnel reflection coefficient
  F = F0 + (1.0 - F0) * pow(1.0 - dotLH, 5.0);

  // V / G - geometric attenuation or shadowing factor
  float k = alpha/2.0;
  vis = G1V(dotNL,k)*G1V(dotNV,k);

  vec3 specular = dotNL * D * F * vis;
  //float specular = F;
  return specular;
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec3 normalWorld = getNormal();
    vec3 eyeDirWorld = normalize(vEyeDirWorld);

    vec3 albedo = getAlbedo();
    float roughness = getRoughness();
    float metalness = getMetalness();
    /*albedo = vec3(1.0);*/
    vec3 irradianceColor = getIrradiance(eyeDirWorld, normalWorld);

    vec3 reflectionColor = getPrefilteredReflection(eyeDirWorld, normalWorld, roughness);

    vec3 F0 = vec3(abs((1.0 - uIor) / (1.0 + uIor)));
    F0 = F0 * F0;
    //F0 = vec3(0.04); //0.04 is default for non-metals in UE4
    F0 = mix(F0, albedo, metalness);

    float NdotV = saturate( dot( normalWorld, eyeDirWorld ) );
    vec3 reflectance = EnvBRDFApprox( F0, roughness, NdotV );

    vec3 diffuseColor = albedo * (1.0 - metalness);
    vec3 specularColor = mix(vec3(1.0), albedo, metalness); 
    
    //light

    vec3 sunL = normalize(uSunPosition);
    vec3 sunColor = sky(sunL, sunL).rgb;

    float dotNsunL = max(0.0, dot(normalWorld, sunL));
    float sunDiffuse = dotNsunL;
    float illuminated = 1.0;

    //shadows
    if (uShadowQuality > 0.0) {
        vec4 lightViewPosition = uLightViewMatrix * vec4(vPositionWorld, 1.0);
        float lightDistView = -lightViewPosition.z;
        vec4 lightDeviceCoordsPosition = uLightProjectionMatrix * lightViewPosition;
        vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
        float lightDeviceCoordsZ = lightDeviceCoordsPosition.z / lightDeviceCoordsPosition.w;
        vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

        if (uShadowQuality == 1.0) {
            illuminated = texture2DCompare(uShadowMap, lightUV, lightDistView - uBias);
        }
        if (uShadowQuality == 2.0) {
            illuminated = texture2DShadowLerp(uShadowMap, uShadowMapSize, lightUV, lightDistView - uBias);
        }
        if (uShadowQuality == 3.0) {
            illuminated = PCF(uShadowMap, uShadowMapSize, lightUV, lightDistView - uBias);
        }
    }
    
    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
    vec3 indirectDiffuse = diffuseColor * irradianceColor;
    vec3 indirectSpecular = reflectionColor * specularColor * reflectance;
    vec3 directDiffuse = diffuseColor * sunDiffuse * sunColor * illuminated;
    vec3 directSpecular = directSpecularGGX(normalWorld, eyeDirWorld, sunL, roughness, F0);
    vec3 color = indirectDiffuse + indirectSpecular + directDiffuse + directSpecular;
	
    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalView * 0.5 + 0.5, 1.0);
}
