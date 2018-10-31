#extension GL_EXT_shader_texture_lod : enable

#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require(./EnvMapEquirect.glsl)
#pragma glslify: envMapOctahedral = require(./EnvMapOctahedral.glsl)
#pragma glslify: encodeRGBM = require(../local_modules/glsl-rgbm/encode)
#pragma glslify: decodeRGBM = require(../local_modules/glsl-rgbm/decode)

varying vec3 vNormalWorld;
varying vec3 vPositionWorld;
uniform vec3 uCameraPosition;

uniform sampler2D uEnvMap;
uniform int uEnvMapType;
uniform float uRoughnessLevel;
uniform float uMipmapLevel;
uniform int uSelectedTexture;
uniform bool uCorrectGamma;
uniform float uExposure;
uniform sampler2D uIrradianceMap;

void main () {
  vec3 N = normalize(vNormalWorld);
  vec3 I = normalize(vPositionWorld - uCameraPosition);
  vec3 R = reflect(I, N);
  vec4 color = vec4(0.0);
  if (uEnvMapType == 0) color = texture2D(uEnvMap, envMapEquirect(R));
  if (uEnvMapType == 1) color = texture2D(uEnvMap, envMapOctahedral(R));
  if (uEnvMapType == 2) color = texture2D(uEnvMap, envMapOctahedral(R, uMipmapLevel, uRoughnessLevel));
  if (uCorrectGamma) {
    vec3 reflection = decodeRGBM(color);
    float width = 2048.0;
    float irrSize = 64.0;
    vec2 uv = envMapOctahedral(N);
    // uv = (uv * irrSize + 0.5) / (irrSize - 1.0);  
    // uv = vec2((width - irrSize + irrSize * uv.x) / width , (width - irrSize + irrSize * uv.y) / width);
    // uv = envMapOctahedral(N) * 0.25 + vec2(0.5, 0.0);
    // uv = (uv * 512.0 - 0.5) / 511.0;
    // vec3 irradiance = decodeRGBM(texture2D(uEnvMap, envMapOctahedral(R, 0.0, 0.0)));
    uv += 0.5 / 32.0;
    uv /= 32.0 / 31.0;
    uv = (uv * 32.0 + vec2(2048.0 - 32.0)) / width;
    vec3 irradiance = decodeRGBM(texture2D(uEnvMap, uv));
    // vec3 irradiance = decodeRGBM(texture2D(uIrradianceMap, uv));
    vec3 color = irradiance; //+ 0.1 * reflection;
    // color.rgb = mix(reflection, irradiance, uRoughnessLevel / 5.0);
    color.rgb = reflection;
    // color.rgb *= pow(vec3(0.9, 0.5, 0.1), vec3(2.2));
    color.rgb *= uExposure;
    color.rgb /= (1.0 + color.rgb);
    gl_FragColor.rgb = pow(color.rgb, vec3(1.0/2.2));
    // gl_FragColor.rgb = color.rgb;
    gl_FragColor.a = 1.0;
  } else {
    gl_FragColor = color;
  }
  gl_FragColor.a = 1.0;
}
