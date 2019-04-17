module.exports = /* glsl */`
uniform vec4 uEmissiveColor; // TODO: gltf assumes sRGB color, not linear
uniform float uEmissiveIntensity;

#ifdef USE_EMISSIVE_COLOR_MAP
  uniform sampler2D uEmissiveColorMap; //assumes sRGB color, not linear

  #ifdef USE_EMISSIVE_COLOR_MAP_TEX_COORD_TRANSFORM
    uniform mat3 uEmissiveColorMapTexCoordTransform;
  #endif

  void getEmissiveColor(inout PBRData data) {
    #ifdef USE_EMISSIVE_COLOR_MAP_TEX_COORD_TRANSFORM
      vec2 texCoord = getTextureCoordinates(data, EMISSIVE_COLOR_MAP_TEX_COORD_INDEX, uEmissiveColorMapTexCoordTransform);
    #else
      vec2 texCoord = getTextureCoordinates(data, EMISSIVE_COLOR_MAP_TEX_COORD_INDEX);
    #endif

    data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb * decode(texture2D(uEmissiveColorMap, texCoord), 3).rgb;
  }
#else
  void getEmissiveColor(inout PBRData data) {
    data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb;
  }
#endif
`
