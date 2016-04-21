#ifdef GL_ES
precision highp float;
#endif

#ifdef GL_ES
  #extension GL_EXT_shader_texture_lod : require
  #extension GL_OES_standard_derivatives : require
  #define textureCubeLod textureCubeLodEXT
#else
  #extension GL_ARB_shader_texture_lod : require
#endif

#pragma glslify: envMapEquirect     = require(../local_modules/glsl-envmap-equirect)
#pragma glslify: envMapCube         = require(../local_modules/glsl-envmap-cubemap)
#pragma glslify: toGamma            = require(glsl-gamma/out)
#pragma glslify: toLinear           = require(glsl-gamma/in)
/*#pragma glslify: tonemapUncharted2  = require(../local_modules/glsl-tonemap-uncharted2)*/
/*#pragma glslify: tonemapFilmic  = require(../local_modules/glsl-tonemap-filmic)*/
#pragma glslify: random             = require(glsl-random/lowp)

uniform float uExposure;
uniform float uIor;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;

varying vec2 vTexCord0;

varying vec3 vPositionView;
uniform mat4 uInverseViewMatrix;


float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}


#ifdef USE_ALBEDO_MAP
uniform sampler2D uAlbedoColor; //assumes sRGB color, not linear
vec3 getAlbedo() {
    return toLinear(texture2D(uAlbedoColor, vTexCord0).rgb);
}
#else
uniform vec4 uAlbedoColor; //assumes sRGB color, not linear
vec3 getAlbedo() {
    return toLinear(uAlbedoColor.rgb);
}
#endif

#ifdef USE_ROUGHNESS_MAP
uniform sampler2D uRoughness; //assumes sRGB color, not linear
float getRoughness() {
    return texture2D(uRoughness, vTexCord0).r;
}
#else
uniform float uRoughness;
float getRoughness() {
    return uRoughness;
}
#endif


#ifdef USE_METALNESS_MAP
uniform sampler2D uMetalness; //assumes sRGB color, not linear
float getMetalness() {
    return toLinear(texture2D(uMetalness, vTexCord0).r);
}
#else
uniform float uMetalness;
float getMetalness() {
    return uMetalness;
}
#endif

#ifdef USE_NORMAL_MAP
uniform sampler2D uNormalMap;
#pragma glslify: perturb = require('glsl-perturb-normal')
vec3 getNormal() {
    vec3 normalRGB = texture2D(uNormalMap, vTexCord0).rgb;
    vec3 normalMap = normalRGB * 2.0 - 1.0;

    normalMap.y *= -1.0;

    vec3 N = normalize(vNormalView);
    vec3 V = normalize(vEyeDirView);

    vec3 normalView = perturb(normalMap, N, V, vTexCord0);
    vec3 normalWorld = vec3(uInverseViewMatrix * vec4(normalView, 0.0));
    return normalWorld;
}
#else
vec3 getNormal() {
    return normalize(vNormalWorld);
}
#endif

uniform samplerCube uReflectionMap;
uniform samplerCube uIrradianceMap;

vec3 getIrradiance(vec3 eyeDirWorld, vec3 normalWorld) {
    float maxMipMapLevel = 7.0; //TODO: const
    vec3 reflectionWorld = reflect(-eyeDirWorld, normalWorld);
    vec3 R = envMapCube(reflectionWorld);
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
    vec3 R = envMapCube(reflectionWorld);
    float lod = roughness * maxMipMapLevel;
    float upLod = floor(lod);
    float downLod = ceil(lod);
    vec3 a = textureCubeLod(uReflectionMap, R, upLod).rgb;
    vec3 b = textureCubeLod(uReflectionMap, R, downLod).rgb;

    return mix(a, b, lod - upLod);
}

void main() {
    vec3 normalWorld = getNormal();
    vec3 eyeDirWorld = normalize(vEyeDirWorld);

    vec3 albedo = getAlbedo();
    float roughness = getRoughness();
    float metalness = getMetalness();
    vec3 irradianceColor = getIrradiance(eyeDirWorld, normalWorld);

    vec3 reflectionColor = getPrefilteredReflection(eyeDirWorld, normalWorld, roughness);

    vec3 F0 = vec3(abs((1.0 - uIor) / (1.0 + uIor)));
    F0 = F0 * F0;
    //F0 = vec3(0.04); //0.04 is default for non-metals in UE4
    F0 = mix(F0, albedo, metalness);

    float NdotV = saturate( dot( normalWorld, eyeDirWorld ) );
    vec3 reflectance = EnvBRDFApprox( F0, roughness, NdotV );

    vec3 diffuseColor = albedo * (1.0 - metalness);

    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
    vec3 color = diffuseColor * irradianceColor + reflectionColor * reflectance;
    /*color = vec3(roughness);*/
    //color = irradianceColor;

    //color *= uExposure;

    //color = tonemapUncharted2(color);

    //color = toGamma(color);

    //gl_FragColor.rgb = albedo  + 1.0;

    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalView * 0.5 + 0.5, 1.0);
}
