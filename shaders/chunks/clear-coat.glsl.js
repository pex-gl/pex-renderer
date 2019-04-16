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
      #ifdef USE_CLEAR_COAT_NORMAL_MAP_TEX_COORD_TRANSFORM
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_MAP_TEX_COORD_INDEX, uClearCoatNormalMapTexCoordTransform);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_NORMAL_MAP_TEX_COORD_INDEX);
      #endif

      vec3 normalMap = texture2D(uClearCoatNormalMap, texCoord).rgb * 2.0 - 1.0;
      normalMap.y *= uClearCoatNormalMapScale;
      normalMap = normalize(normalMap);

      vec3 N = normalize(data.normalView);
      vec3 V = normalize(data.eyeDirView);

      vec3 normalView;

      #ifdef USE_TANGENTS
        vec3 bitangent = cross(N, data.tangentView.xyz) * sign(data.tangentView.w);
        mat3 TBN = mat3(data.tangentView.xyz, bitangent, N);
        normalView = normalize(TBN * normalMap);
      #else
        normalMap.xy *= float(gl_FrontFacing) * 2.0 - 1.0;
        // make the output normalView match glTF expected right handed orientation
        normalMap.y *= -1.0;
        normalView = perturb(normalMap, N, V, texCoord);
      #endif

      data.clearCoatNormal = normalize(vec3(data.inverseViewMatrix * vec4(normalView, 0.0)));
    }
  #else
    void getClearCoatNormal(inout PBRData data) {
      // geometric normal without perturbation from normalMap
      data.clearCoatNormal = normalize(vec3(data.inverseViewMatrix * vec4(normalize(data.normalView), 0.0)));
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
    float D = distributionClearCoat(data.clearCoatLinearRoughness, clearCoatNoH, h, data.normalWorld);
    float V = visibilityClearCoat(uClearCoatRoughness, data.clearCoatLinearRoughness, LoH);
    // IOR = 1.5, F0 = 0.04
    float F = F_Schlick(0.04, 1.0, LoH) * uClearCoat;

    Fcc = F;
    return D * V * F;
  }
#endif
`
