#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: textureCubeEnv = require('glsl-textureCube-env')
#pragma glslify: sky = require('glsl-sky')
#pragma glslify: toLinear = require('glsl-gamma/in')
#pragma glslify: toGamma = require(glsl-gamma/out)

uniform mat4 uInverseViewMatrix;
uniform vec4 uAlbedoColor;
uniform samplerCube uSkyIrradianceMap;
uniform vec3 uSunPosition;

uniform mat4 uLightProjectionMatrix;
uniform mat4 uLightViewMatrix;
uniform float uLightNear;
uniform float uLightFar;
uniform sampler2D uShadowMap;

varying vec3 ecNormal;
varying vec3 vWorldPosition;

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

void main() {
    vec3 wcNormal = normalize(vec3(uInverseViewMatrix * vec4(ecNormal, 0.0)));
    vec3 irradiance = textureCubeEnv(uSkyIrradianceMap, wcNormal, flipEnvMap).rgb;
    vec4 albedoColor = toLinear(uAlbedoColor);

    vec3 L = normalize(uSunPosition);
    vec3 lightColor = sky(L, L).rgb;

    float dotNL = max(0.0, dot(wcNormal, L));
    float diffuse = dotNL;


    //shadows
    vec4 lightViewPosition = uLightViewMatrix * vec4(vWorldPosition, 1.0);
    float lightDist1 = -lightViewPosition.z;
    vec4 lightDeviceCoordsPosition = uLightProjectionMatrix * lightViewPosition;
    vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
    vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;
    //TODO: does slope based bias help?
    float bias = 0.05 * tan(acos(dotNL));
    bias = clamp(bias, 0.0, 1.0);
    float lightDist2 = readDepth(uShadowMap, vec2(lightUV.x, lightUV.y));

    if (lightDist1 > lightDist2 + bias) {
        diffuse = 0.0;
        //gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }
    else {
        //gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }

    //if (lightDist2 > 99990.0) {
        gl_FragColor.rgb = albedoColor.rgb * irradiance + albedoColor.rgb * diffuse * lightColor;
        gl_FragColor.a = 1.0;
    //}
}
