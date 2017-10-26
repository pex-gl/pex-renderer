#ifdef GL_ES
  #extension GL_EXT_shader_texture_lod : require
  #extension GL_OES_standard_derivatives : require
  // #extension GL_EXT_draw_buffers : require
  #define textureCubeLod textureCubeLodEXT
#else
  #extension GL_ARB_shader_texture_lod : require
#endif

#ifdef GL_ES
precision mediump float;
#endif

#pragma glslify: envMapOctahedral = require(./EnvMapOctahedral.glsl)
#pragma glslify: decode = require(./decode.glsl)
#pragma glslify: encode = require(./encode.glsl)

uniform float uIor;

varying vec3 vNormalWorld;
varying vec3 vNormalView;
varying vec3 vEyeDirWorld;
varying vec3 vEyeDirView;

varying vec2 vTexCoord0;

varying vec3 vPositionWorld;
varying vec3 vPositionView;

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

float pi = 3.14159;
#define PI 3.14159265359
#define TwoPI (2.0 * 3.14159265359)

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

#endif


#if NUM_POINT_LIGHTS > 0

struct PointLight {
    vec3 position;
    vec4 color;
    float radius;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];

#endif

#if NUM_SPOT_LIGHTS > 0

struct SpotLight {
    vec3 position;
    vec3 direction;
    vec4 color;
    float angle;
    float distance;
};

uniform SpotLight uSpotLights[NUM_SPOT_LIGHTS];

#endif
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

float saturate(float f) {
    return clamp(f, 0.0, 1.0);
}

#ifdef USE_BASE_COLOR_MAP
    uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear
    uniform sampler2D uBaseColorMap; //assumes sRGB color, not linear
    vec3 getBaseColor() {
        return decode(uBaseColor, 3).rgb * decode(texture2D(uBaseColorMap, vTexCoord0), 3).rgb;
    }
#else
    uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear
    vec3 getBaseColor() {
        return decode(uBaseColor, 3).rgb;
    }
#endif

#ifdef USE_EMISSIVE_COLOR_MAP
    uniform sampler2D uEmissiveColorMap; //assumes sRGB color, not linear
    vec3 getEmissiveColor() {
        return decode(texture2D(uEmissiveColorMap, vTexCoord0), 3).rgb;
    }
#else
    uniform vec4 uEmissiveColor; //assumes sRGB color, not linear
    vec3 getEmissiveColor() {
        return decode(uEmissiveColor, 3).rgb;
    }
#endif

#ifdef USE_METALLIC_ROUGHNESS_MAP
    // R = ?, G = roughness, B = metallic
    uniform sampler2D uMetallicRoughnessMap;
    // TODO: sampling the same texture twice
    float getMetallic() {
        return texture2D(uMetallicRoughnessMap, vTexCoord0).b;
    }
    float getRoughness() {
        return texture2D(uMetallicRoughnessMap, vTexCoord0).g;
    }
#else

#ifdef USE_METALLIC_MAP
    uniform sampler2D uMetallicMap; //assumes linear, TODO: check gltf
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
    uniform sampler2D uRoughnessMap; //assumes linear, TODO: check glTF
    float getRoughness() {
        return texture2D(uRoughnessMap, vTexCoord0).r + 0.01;
    }
#else
    uniform float uRoughness;
    float getRoughness() {
        return uRoughness + 0.01;
    }
#endif

//USE_METALLIC_ROUGHNESS_MAP
#endif

#ifdef USE_NORMAL_MAP
    uniform sampler2D uNormalMap;
    #pragma glslify: perturb = require('glsl-perturb-normal')
    vec3 getNormal() {
        vec3 normalRGB = texture2D(uNormalMap, vTexCoord0).rgb;
        vec3 normalMap = normalRGB * 2.0 - 1.0;

        // normalMap.y *= -1.0;
        /*normalMap.x *= -1.0;*/
        // vec3 dFdxPos = dFdx( vPositionView );
        // vec3 dFdyPos = dFdy( vPositionView );

        vec3 N = normalize(vNormalView);
        // N = normalize( cross(dFdxPos,dFdyPos ));
        vec3 V = normalize(vEyeDirView);

        vec3 normalView = perturb(normalMap, N, V, vTexCoord0);
        vec3 normalWorld = vec3(uInverseViewMatrix * vec4(normalView, 0.0));
        return normalWorld;

    }
#endif

// FIXME: why i can't do #elseif

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
#ifndef USE_NORMAL_MAP
    vec3 getNormal() {
        // vec3 dFdxPos = dFdx( vPositionWorld );
        // vec3 dFdyPos = dFdy( vPositionWorld );

        // vec3 N = normalize( cross(dFdxPos,dFdyPos ));
        // return N;

        return normalize(vNormalWorld);
    }
#endif
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
    //vec3 R = envMapCube(data.normalWorld);
    float lod = roughness * maxMipMapLevel;
    float upLod = floor(lod);
    float downLod = ceil(lod);
    vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, upLod)), uReflectionMapEncoding).rgb;
    vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, downLod)), uReflectionMapEncoding).rgb;
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

float GGX(vec3 N, vec3 H, float a) {
  float a2 = a * a;
  float NdotH  = max(dot(N, H), 0.0);
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

float GeometrySchlickGGX(float NdotV, float roughness) {
  // non IBL k
  float r = (roughness + 1.0);
  float k = (r*r) / 8.0;

  float nom   = NdotV;
  float denom = NdotV * (1.0 - k) + k;

  return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
  float NdotV = max(dot(N, V), 0.0); // TODO: duplicate
  float NdotL = max(dot(N, L), 0.0); // TODO: duplicate
  float ggx1 = GeometrySchlickGGX(NdotV, roughness);
  float ggx2 = GeometrySchlickGGX(NdotL, roughness);

  return ggx1 * ggx2;
}

vec3 FresnelSchlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
/*
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
*/

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

#pragma glslify: evalAreaLight=require('./PBR.arealight.glsl', NUM_AREA_LIGHTS=NUM_AREA_LIGHTS, uCameraPosition=uCameraPosition,AreaLight=AreaLight, uAreaLights=uAreaLights, ltc_mat=ltc_mat, ltc_mag=ltc_mag, view=view)

#endif

void main() {
    vec3 normalWorld = getNormal();
    vec3 eyeDirWorld = normalize(vEyeDirWorld);

    vec3 baseColor = getBaseColor();
#ifdef USE_INSTANCED_COLOR
    baseColor *= decode(vColor, 3).rgb;
#endif
    vec3 emissiveColor = getEmissiveColor();
    float roughness = getRoughness();
    // avoid disappearing highlights at roughness 0
    roughness = 0.004 + 0.996 * roughness;
    float metallic = getMetallic();

    // http://www.codinglabs.net/article_physically_based_rendering_cook_torrance.aspx
    // vec3 F0 = vec3(abs((1.0 - uIor) / (1.0 + uIor)));
    // F0 = F0; //0.04 is default for non-metals in UE4
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, baseColor, metallic);

    // view vector in world space
    vec3 V = normalize(uCameraPosition - vPositionWorld);

    // TODO: remove specular color, get kS from fresnel for area lights and IBL
    vec3 specularColor = mix(vec3(1.0), baseColor, metallic);

    vec3 indirectDiffuse = vec3(0.0);
    vec3 indirectSpecular = vec3(0.0);
    vec3 directDiffuse = vec3(0.0);
    vec3 directSpecular = vec3(0.0);

    float ao = 1.0;
#ifdef USE_AO
    vec2 vUV = vec2(gl_FragCoord.x / uScreenSize.x, gl_FragCoord.y / uScreenSize.y);
    ao = texture2D(uAO, vUV).r;
#endif

    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
#ifdef USE_NORMALS
#ifdef USE_REFLECTION_PROBES
    float NdotV = saturate( dot( normalWorld, eyeDirWorld ) );
    vec3 reflectance = EnvBRDFApprox( F0, roughness, NdotV );
    vec3 irradianceColor = getIrradiance(eyeDirWorld, normalWorld);
    vec3 reflectionColor = getPrefilteredReflection(eyeDirWorld, normalWorld, roughness);
    vec3 kS = F0;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;
    indirectDiffuse = kD * baseColor * irradianceColor;
    indirectSpecular = reflectionColor * reflectance;
#endif

    //lights
#if NUM_DIRECTIONAL_LIGHTS > 0
    for(int i=0; i<NUM_DIRECTIONAL_LIGHTS; i++) {
        DirectionalLight light = uDirectionalLights[i];

        //shadows
        vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0);
        float lightDistView = -lightViewPosition.z;
        vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
        vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
        float lightDeviceCoordsZ = lightDeviceCoordsPosition.z / lightDeviceCoordsPosition.w;
        vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

        float illuminated = 0.0;
        if (i == 0) illuminated += directionalShadow(uDirectionalLightShadowMaps[0], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#if NUM_DIRECTIONAL_LIGHTS > 1
        if (i == 1) illuminated += directionalShadow(uDirectionalLightShadowMaps[1], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
#endif

        if (illuminated > 0.0) {
            vec3 L = normalize(-light.direction);
            vec3 N = normalWorld;
            vec3 H = normalize(V + L);
            float NdotL = max(0.0, dot(N, L));
            float HdotV = max(0.0, dot(H, V));
            float NdotV = max(0.0, dot(N, V));

            vec3 F = FresnelSchlick(HdotV, F0);

            vec3 kS = F;
            vec3 kD = vec3(1.0) - kS;

            kD *= 1.0 - metallic;

            float NDF = GGX(N, H, roughness);

            float G = GeometrySmith(N, V, L, roughness);

            vec3 nominator = NDF * G * F;
            float denominator = 4.0 * NdotV * NdotL + 0.001;
            vec3 brdf = nominator / denominator;

            vec3 lightColor = decode(light.color, 3).rgb;
            lightColor *= light.color.a; // intensity
            vec3 light = NdotL * lightColor * illuminated;

            directDiffuse += kD * baseColor / PI * light;
            directSpecular += brdf * light;
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

        // Based on UE4
        float distanceRatio = clamp(1.0 - pow(dist/light.radius, 4.0), 0.0, 1.0);
        float falloff = (distanceRatio * distanceRatio) / (dist * dist + 1.0);

        vec3 lightColor = decode(light.color, 3).rgb;
        lightColor *= light.color.a;
        //TODO: specular light conservation
        // directDiffuse += baseColor * dotNL * lightColor * falloff;
        // directSpecular += directSpecularGGX(normalWorld, eyeDirWorld, L, roughness, F0) * light.color.rgb * falloff;

        vec3 N = normalWorld;
        vec3 H = normalize(V + L);
        float NdotL = max(0.0, dot(N, L));
        float HdotV = max(0.0, dot(H, V));
        float NdotV = max(0.0, dot(N, V));

        vec3 F = FresnelSchlick(HdotV, F0);

        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;

        kD *= 1.0 - metallic;

        float NDF = GGX(N, H, roughness);

        float G = GeometrySmith(N, V, L, roughness);

        vec3 nominator = NDF * G * F;
        float denominator = 4.0 * NdotV * NdotL + 0.001;
        vec3 brdf = nominator / denominator;

        vec3 radiance = lightColor * falloff;

        directDiffuse += kD * baseColor / PI * NdotL * radiance;
        directSpecular += brdf * NdotL * radiance;
    }
#endif

#if NUM_SPOT_LIGHTS > 0
    for(int i=0; i<NUM_SPOT_LIGHTS; i++) {
        SpotLight light = uSpotLights[i];

        const float spotlightLinearAtt = 1.0;
        float dist = distance(vPositionWorld, light.position);
        vec3 vDir = (vPositionWorld - light.position) / dist;
        float distAttenuation = 1.0/(dist * spotlightLinearAtt);

        float fCosine = dot(light.direction, vDir);
        float cutOff = cos(light.angle);

        float fDif = 1.0 - cutOff;
        float fFactor = clamp((fCosine - cutOff)/fDif, 0.0, 1.0);

        fFactor = pow(fFactor, 2.0);

        if (fCosine > cutOff) {
          vec3 L = normalize(-light.direction);

          float intensity = max(dot(normalWorld, L), 0.0);
          //vec4 spec = vec4(0.0);
          //if (intensity > 0.0) {
          //  vec3 eye = vec3(0.0, 0.0, 1.0);
          //  vec3 h = normalize(ecLightDir + eye);
          //  float intSpec = max(dot(h, ecN), 0.0);
          //  spec = vec4(1.0) * pow(intSpec, 128.0);
          //}

          const float distAttenuation = 1.0;
          //return fFactor * distAttenuation * intensity * spotlightColor + spec;
          directDiffuse += fFactor * distAttenuation * intensity * light.color.rgb;

        }

        /*
        // Based on UE4
        float distanceRatio = clamp(1.0 - pow(dist/light.radius, 4.0), 0.0, 1.0);
        float falloff = (distanceRatio * distanceRatio) / (dist * dist + 1.0);

        vec3 lightColor = decode(light.color, 3).rgb;
        lightColor *= light.color.a;
        //TODO: specular light conservation
        // directDiffuse += baseColor * dotNL * lightColor * falloff;
        // directSpecular += directSpecularGGX(normalWorld, eyeDirWorld, L, roughness, F0) * light.color.rgb * falloff;

        vec3 N = normalWorld;
        vec3 H = normalize(V + L);
        float NdotL = max(0.0, dot(N, L));
        float HdotV = max(0.0, dot(H, V));
        float NdotV = max(0.0, dot(N, V));

        vec3 F = FresnelSchlick(HdotV, F0);

        vec3 kS = F;
        vec3 kD = vec3(1.0) - kS;

        kD *= 1.0 - metallic;

        float NDF = GGX(N, H, roughness);

        float G = GeometrySmith(N, V, L, roughness);

        vec3 nominator = NDF * G * F;
        float denominator = 4.0 * NdotV * NdotL + 0.001;
        vec3 brdf = nominator / denominator;

        vec3 radiance = lightColor * falloff;

        directDiffuse += kD * baseColor / PI * NdotL * radiance;
        directSpecular += brdf * NdotL * radiance;
        */
    }
#endif

    vec3 indirectArea = vec3(0.0);

#if NUM_AREA_LIGHTS > 0
    for(int i=0; i<NUM_AREA_LIGHTS; i++) {
        AreaLight light = uAreaLights[i];

        // TODO: kD, kS
        //if (length(emissiveColor) == 0.0) {
            indirectArea += evalAreaLight(light, vPositionWorld, normalWorld, baseColor, specularColor, roughness); //TEMP: fix roughness
            //indirectArea = evalAreaLight(light, vPositionWorld, normalWorld,roughness); //TEMP: fix roughness
            //indirectArea = evalAreaLight(light, vPositionView, (uNormalMatrix*normalWorld).xyz, diffuseColor, specularColor, roughness); //TEMP: fix roughness
        //}
    }
#endif
    vec3 color = emissiveColor + ao * indirectDiffuse + indirectSpecular + directDiffuse + directSpecular + indirectArea;
#else  // USE_NORMALS
    vec3 color = ao * baseColor;
#endif // USE_NORMALS
    gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);
}
