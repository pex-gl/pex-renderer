module.exports = /* glsl */`
uniform vec4 uBaseColor; // TODO: gltf assumes sRGB color, not linear

#ifdef USE_BASE_COLOR_MAP
  uniform sampler2D uBaseColorMap; // assumes sRGB color, not linear

  void getBaseColor(inout PBRData data) {
    vec4 texelColor = texture2D(uBaseColorMap, data.texCoord0);

    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
    data.baseColor = decode(uBaseColor, 3).rgb * decode(texelColor, 3).rgb;
    #endif

    data.opacity = uBaseColor.a * texelColor.a;
  }
#else
  void getBaseColor(inout PBRData data) {
    #if !defined(DEPTH_PASS_ONLY) && !defined(DEPTH_PRE_PASS_ONLY)
    data.baseColor = decode(uBaseColor, 3).rgb;
    #endif

    data.opacity = uBaseColor.a;
  }
#endif
`
