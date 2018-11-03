module.exports = /* glsl */`
uniform vec4 uEmissiveColor; // TODO: gltf assumes sRGB color, not linear
uniform float uEmissiveIntensity;

#ifdef USE_EMISSIVE_COLOR_MAP
  uniform sampler2D uEmissiveColorMap; //assumes sRGB color, not linear

  void getEmissiveColor(inout PBRData data) {
    data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb * decode(texture2D(uEmissiveColorMap, vTexCoord0), 3).rgb;
  }
#else
  void getEmissiveColor(inout PBRData data) {
    data.emissiveColor = uEmissiveIntensity * decode(uEmissiveColor, 3).rgb;
  }
#endif
`
