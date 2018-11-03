const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */`
#ifdef USE_DRAW_BUFFERS
  #extension GL_EXT_draw_buffers : require
#endif

precision highp float;

#define USE_TONEMAPPING

// Variables
// assuming texture in Linear Space
// most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
uniform int uEnvMapEncoding;
uniform int uOutputEncoding;
uniform float uBackgroundBlur;

varying vec3 wcNormal;

uniform bool uUseTonemapping;
#ifdef USE_TONEMAPPING
  ${SHADERS.tonemapUncharted2}
  uniform float uExposure;
#endif

// Includes
${SHADERS.math.PI}
${SHADERS.math.TWO_PI}

${SHADERS.rgbm}
${SHADERS.gamma}
${SHADERS.encodeDecode}
${SHADERS.envMapEquirect}
${SHADERS.octMap}
${SHADERS.irradiance}

void main() {
  vec3 N = normalize(wcNormal);

  vec4 color = vec4(0.0);

  if (uBackgroundBlur <= 0.0) {
    color = decode(texture2D(uEnvMap, envMapEquirect(N)), uEnvMapEncoding);
  } else {
    color = vec4(getIrradiance(N, uEnvMap, uEnvMapEncoding), 1.0);
  }
  #ifdef USE_TONEMAPPING
    if (uUseTonemapping) {
      color.rgb *= uExposure;
      color.rgb = tonemapUncharted2(color.rgb);
    }
  #endif

  gl_FragData[0] = encode(color, uOutputEncoding);
  #ifdef USE_DRAW_BUFFERS
    gl_FragData[1] = vec4(0.0);
  #endif
}
`
