const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */`
precision highp float;

// Variables
varying vec3 vNormalView;
varying vec2 vTexCoord0;
varying vec3 vPositionView;

struct PBRData {
  vec2 texCoord0;
  vec4 color;
  float opacity;
};

// Includes
${SHADERS.baseColor}
${SHADERS.alpha}
${SHADERS.depthPack}

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

  float far = 10.0; // TODO: hardcoded far for depth pass
  gl_FragColor = packDepth(length(vPositionView) / far);
}
`
