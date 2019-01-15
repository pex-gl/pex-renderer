const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */`
// Variables
varying vec3 vNormalView;
varying vec2 vTexCoord0;
varying vec3 vPositionView;

struct PBRData {
  vec2 texCoord0;
  float opacity;
};

// Includes
${SHADERS.baseColor}
${SHADERS.alpha}

void main() {
  PBRData data;
  data.texCoord0 = vTexCoord0;

  getBaseColor(data);

  #ifdef USE_ALPHA_MAP
    data.opacity *= texture2D(uAlphaMap, data.texCoord0).r;
  #endif

  #ifdef USE_ALPHA_TEST
    alphaTest(data);
  #endif

  vec3 normal = vNormalView;
  normal *= float(gl_FrontFacing) * 2.0 - 1.0;

  gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
`
