module.exports = /* glsl */ `
#if defined(USE_VERTEX_COLORS) || defined(USE_INSTANCED_COLOR)
  void getTintColor(inout PBRData data) {
    vec3 tintColor = decode(vColor, 3).rgb;

    #ifdef USE_UNLIT_WORKFLOW
      data.baseColor *= tintColor;
    #else
      data.diffuseColor *= tintColor;
      data.specularColor *= tintColor;
    #endif
  }
#endif
`
