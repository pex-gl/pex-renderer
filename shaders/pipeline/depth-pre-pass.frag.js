const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */ `
precision highp float;

// Variables
varying vec3 vNormalView;
varying vec2 vTexCoord0;
#ifdef USE_TEXCOORD_1
  varying vec2 vTexCoord1;
#endif
varying vec3 vPositionView;

#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  varying vec4 vColor;
#endif

struct PBRData {
  vec2 texCoord0;
  vec2 texCoord1;
  float opacity;
};

// Includes
${SHADERS.textureCoordinates}
${SHADERS.baseColor}
${SHADERS.alpha}

void main() {
  PBRData data;
  data.texCoord0 = vTexCoord0;

  #ifdef USE_TEXCOORD_1
    data.texCoord1 = vTexCoord1;
  #endif

  getBaseColor(data);

  #ifdef USE_ALPHA_MAP
    #ifdef USE_ALPHA_MAP_TEX_COORD_TRANSFORM
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_MAP_TEX_COORD_INDEX, uAlphaMapTexCoordTransform);
    #else
      vec2 alphaTexCoord = getTextureCoordinates(data, ALPHA_MAP_TEX_COORD_INDEX);
    #endif
    data.opacity *= texture2D(uAlphaMap, alphaTexCoord).r;
  #endif

  #ifdef USE_ALPHA_TEST
    alphaTest(data);
  #endif

  vec3 normal = vNormalView;
  normal *= float(gl_FrontFacing) * 2.0 - 1.0;

  gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
}
`
