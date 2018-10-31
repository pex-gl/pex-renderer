#extension GL_EXT_shader_texture_lod : enable

#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require(./EnvMapEquirect.glsl)
#pragma glslify: envMapOctahedral = require(./EnvMapOctahedral.glsl)
#pragma glslify: encodeRGBM = require(../local_modules/glsl-rgbm/encode)
#pragma glslify: decodeRGBM = require(../local_modules/glsl-rgbm/decode)

uniform sampler2D uEnvMap;
uniform int uEnvMapType;
uniform float uMipmapLevel;
uniform float uRoughnessLevel;
uniform bool uCorrectGamma;
uniform float uExposure;
varying vec3 wcNormal;

void main() {
  vec3 N = normalize(wcNormal);
  vec4 color = vec4(0.0);
  if (uEnvMapType == 0) color = texture2D(uEnvMap, envMapEquirect(N));
  if (uEnvMapType == 1) color = texture2D(uEnvMap, envMapOctahedral(N));
  if (uEnvMapType == 2) color = texture2D(uEnvMap, envMapOctahedral(N, uMipmapLevel, uRoughnessLevel));
  
  // if (uSelectedTexture == 1) color = textureCube(uDynamicCubemap, N).rgb;
  // if (uSelectedTexture == 2) color = texture2DLodEXT(uDynamicOctMap, envMapOctahedral(N, 1024.0, uBorder * 0.5), uMipmapLevel).rgb;
  // if (uSelectedTexture == 3) color = texture2D(uDynamicOctMapAtlas, envMapOctahedralLod(N, uRoughnessLevel, uBorder)).rgb;
  if (uCorrectGamma) {
    color.rgb = decodeRGBM(color);
    color.rgb *= uExposure;
    color.rgb /= (1.0 + color.rgb);
    gl_FragColor.rgb = pow(color.rgb, vec3(1.0/2.2));
    // gl_FragColor.rgb = color.rgb;
    gl_FragColor.a = 1.0;
  } else {
    // gl_FragColor = encodeRGBM(color.rgb);
    gl_FragColor = color.rgba;
  }
}

