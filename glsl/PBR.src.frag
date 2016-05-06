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
uniform mat4 uInverseViewMatrix;


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
uniform samplerCube uIrradianceMap;

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
    vec3 R = envMapCube(reflectionWorld);
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

void main() {
    vec3 normalWorld = getNormal();
    vec3 eyeDirWorld = normalize(vEyeDirWorld);

    vec3 baseColor = getBaseColor();
    float roughness = getRoughness();
    float metallic = getMetallic();
    vec3 irradianceColor = getIrradiance(eyeDirWorld, normalWorld);
    vec3 reflectionColor = getPrefilteredReflection(eyeDirWorld, normalWorld, roughness);

    vec3 F0 = vec3(abs((1.0 - uIor) / (1.0 + uIor)));
    F0 = F0 * F0; //0.04 is default for non-metals in UE4
    F0 = mix(F0, baseColor, metallic);

    float NdotV = saturate( dot( normalWorld, eyeDirWorld ) );
    vec3 reflectance = EnvBRDFApprox( F0, roughness, NdotV );

    vec3 diffuseColor = baseColor * (1.0 - metallic);
    vec3 specularColor = mix(vec3(1.0), baseColor, metallic);
    
    //TODO: No kd? so not really energy conserving
    //we could use disney brdf for irradiance map to compensate for that like in Frostbite
    vec3 indirectDiffuse = diffuseColor * irradianceColor;
    vec3 indirectSpecular = reflectionColor * specularColor * reflectance;

    vec3 directDiffuse = vec3(0.0);
    vec3 directSpecular = vec3(0.0);

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


    /*color.r = 1.0;*/
    gl_FragData[0] = vec4(color, 1.0);
    gl_FragData[1] = vec4(vNormalView * 0.5 + 0.5, 1.0);
}
