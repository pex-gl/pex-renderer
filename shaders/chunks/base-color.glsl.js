module.exports = /* glsl */`
uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear

#ifdef USE_BASE_COLOR_MAP
  uniform sampler2D uBaseColorMap; // assumes sRGB color, not linear
  uniform int uBaseColorMapTexCoordIndex;

  void getBaseColor(inout PBRData data) {
    vec4 texelColor = texture2D(uBaseColorMap, getTextureCoordinates(data, uBaseColorMapTexCoordIndex));

    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.baseColor = decode(uBaseColor, 3).rgb * decode(texelColor, 3).rgb;
    #endif

    #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
      data.opacity = uBaseColor.a * texelColor.a * vColor.a;
    #else
      data.opacity = uBaseColor.a * texelColor.a;
    #endif
  }
#else
  void getBaseColor(inout PBRData data) {
    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
      data.baseColor = decode(uBaseColor, 3).rgb;
    #endif

    #if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
      data.opacity = uBaseColor.a * vColor.a;
    #else
      data.opacity = uBaseColor.a;
    #endif
  }
#endif
`
