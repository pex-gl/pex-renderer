module.exports = /* glsl */ `
#ifdef USE_ALPHA_MAP
  uniform sampler2D uAlphaMap;

  #ifdef ALPHA_MAP_TEX_COORD_TRANSFORM
    uniform mat3 uAlphaMapTexCoordTransform;
  #endif
#endif

#ifdef USE_ALPHA_TEST
  uniform float uAlphaTest; // assumes sRGB color, not linear

  void alphaTest(inout PBRData data) {
    if (data.opacity < uAlphaTest) discard;
    // if (length(data.emissiveColor) < 0.1) discard;
    // else data.baseColor = vec3(1.0, 0.0, 0.0);
  }
#endif
`
