module.exports = /* glsl */ `
#ifdef USE_CLEAR_COAT
  uniform float uClearCoat;
  uniform float uClearCoatRoughness;

  #ifdef USE_CLEAR_COAT_NORMAL_MAP
    uniform sampler2D uClearCoatNormalMap;
    uniform float uClearCoatNormalMapScale;

    #ifdef USE_CLEAR_COAT_NORMAL_MAP_TEX_COORD_TRANSFORM
      uniform mat3 uClearCoatNormalMapTexCoordTransform;
    #endif

    void getClearCoatNormal(inout PBRData data) {
      vec3 normalWorld = vec3(data.inverseViewMatrix * vec4(normalize(data.normalView), 0.0));

      #ifdef USE_CLEAR_COAT_NORMAL_MAP_TEX_COORD_TRANSFORM
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_MAP_TEX_COORD_INDEX, uClearCoatNormalMapTexCoordTransform);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_MAP_TEX_COORD_INDEX);
      #endif

      vec3 normalMap = texture2D(uClearCoatNormalMap, texCoord).rgb * 2.0 - 1.0;
      normalMap.y *= uClearCoatNormalMapScale;
      normalMap = normalize(normalMap);
      normalMap.xy *= float(gl_FrontFacing) * 2.0 - 1.0;
      normalMap.y *= -1.0;

      data.clearCoatNormal = normalize(normalWorld * normalMap);
    }
  #else
    void getClearCoatNormal(inout PBRData data) {
      data.clearCoatNormal = vec3(data.inverseViewMatrix * vec4(normalize(data.normalView), 0.0)); // normalWorld
    }
  #endif


  // IOR = 1.5, F0 = 0.04
  vec3 f0ClearCoatToSurface(const vec3 f0) {
    #if defined(TARGET_MOBILE)
      return saturate(f0 * (f0 * 0.526868 + 0.529324) - 0.0482256);
    #else
      return saturate(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998);
    #endif
  }

  float clearCoatLobe(const PBRData data, const vec3 h, float NoH, float LoH, out float Fcc) {
    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      float clearCoatNoH = saturate(dot(data.clearCoatNormal, h));
    #else
      float clearCoatNoH = NoH;
    #endif
    float D = distributionClearCoat(data.clearCoatLinearRoughness, clearCoatNoH, h);
    float V = visibilityClearCoat(uClearCoatRoughness, data.clearCoatLinearRoughness, LoH);
    // IOR = 1.5, F0 = 0.04
    float F = F_Schlick(0.04, 1.0, LoH) * uClearCoat;

    Fcc = F;
    return D * V * F;
  }
#endif
`
