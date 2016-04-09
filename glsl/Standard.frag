#ifdef GL_ES
precision highp float;
#extension GL_EXT_draw_buffers : require
#endif

#pragma glslify: textureCubeEnv = require('glsl-textureCube-env')
#pragma glslify: sky = require('glsl-sky')
#pragma glslify: toLinear = require('glsl-gamma/in')
#pragma glslify: toGamma = require(glsl-gamma/out)

uniform mat4 uInverseViewMatrix;
uniform vec4 uAlbedoColor;
uniform sampler2D uAlbedoColorTex;
uniform bool uAlbedoColorTexEnabled;
uniform samplerCube uSkyIrradianceMap;
uniform vec3 uSunPosition;

uniform mat4 uLightProjectionMatrix;
uniform mat4 uLightViewMatrix;
uniform float uLightNear;
uniform float uLightFar;
uniform sampler2D uShadowMap;
uniform vec2 uShadowMapSize;
uniform float uBias;

varying vec3 ecNormal;
varying vec3 vWorldPosition;
varying vec2 vTexCoord0;

const float flipEnvMap = 1.0;

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float ndcDepthToEyeSpace(float ndcDepth) {
    return 2.0 * uLightNear * uLightFar / (uLightFar + uLightNear - ndcDepth * (uLightFar - uLightNear));
}

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
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
            vec2 off = vec2(x,y)/size;
            result += texture2DShadowLerp(depths, size, uv+off, compare);
        }
    }
    return result/25.0;
}

void main() {
    vec3 wcNormal = normalize(vec3(uInverseViewMatrix * vec4(ecNormal, 0.0)));
    vec3 irradiance = textureCubeEnv(uSkyIrradianceMap, wcNormal, flipEnvMap).rgb;
    vec4 albedoColor = toLinear(uAlbedoColor);

    if (uAlbedoColorTexEnabled) {
        albedoColor = toLinear(texture2D(uAlbedoColorTex, vTexCoord0));
    }

    vec3 L = normalize(uSunPosition);
    vec3 lightColor = sky(L, L).rgb;

    float dotNL = max(0.0, dot(wcNormal, L));
    float diffuse = dotNL;


    //shadows
    vec4 lightViewPosition = uLightViewMatrix * vec4(vWorldPosition, 1.0);
    float lightDistView = -lightViewPosition.z;
    vec4 lightDeviceCoordsPosition = uLightProjectionMatrix * lightViewPosition;
    vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
    vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;


    //float illuminated = texture2DShadowLerp(uShadowMap, uShadowMapSize, lightUV, lightDistView - uBias);
    float illuminated = PCF(uShadowMap, uShadowMapSize, lightUV, lightDistView - uBias);
    //illuminated = texture2DCompare(uShadowMap, lightUV, lightDistView - uBias);



    gl_FragData[0].rgb = albedoColor.rgb * irradiance + albedoColor.rgb * diffuse * lightColor * illuminated;
    gl_FragData[0].a = 1.0;

    gl_FragData[1] = vec4(ecNormal * 0.5 + 0.5, 1.0);
}
