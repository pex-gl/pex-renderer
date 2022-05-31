export default /* glsl */ `
#ifdef USE_CLEAR_COAT
  uniform float uClearCoat;
  uniform float uClearCoatRoughness;

  #ifdef USE_CLEAR_COAT_MAP
    uniform sampler2D uClearCoatMap;
    uniform float uClearCoatMapScale;

    #ifdef USE_CLEAR_COAT_MAP_TEX_COORD_TRANSFORM
      uniform mat3 uClearCoatMapTexCoordTransform;
    #endif

    void getClearCoat(inout PBRData data) {
      #ifdef USE_CLEAR_COAT_MAP_TEX_COORD_TRANSFORM
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_MAP_TEX_COORD_INDEX, uClearCoatMapTexCoordTransform);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_MAP_TEX_COORD_INDEX);
      #endif

      data.clearCoat = uClearCoat * texture2D(uClearCoatMap, texCoord).r;
    }
  #else
    void getClearCoat(inout PBRData data) {
      data.clearCoat = uClearCoat;
    }
  #endif

  #ifdef USE_CLEAR_COAT_ROUGHNESS_MAP
    uniform sampler2D uClearCoatRoughnessMap;
    uniform float uClearCoatRoughnessMapScale;

    #ifdef USE_CLEAR_COAT_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
      uniform mat3 uClearCoatRoughnessMapTexCoordTransform;
    #endif

    void getClearCoatRoughness(inout PBRData data) {
      #ifdef USE_CLEAR_COAT_ROUGHNESS_MAP_TEX_COORD_TRANSFORM
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_ROUGHNESS_MAP_TEX_COORD_INDEX, uClearCoatRoughnessMapTexCoordTransform);
      #else
        vec2 texCoord = getTextureCoordinates(data, CLEAR_COAT_ROUGHNESS_MAP_TEX_COORD_INDEX);
      #endif

      data.clearCoatRoughness = uClearCoatRoughness * texture2D(uClearCoatRoughnessMap, texCoord).g;
    }
  #else
    void getClearCoatRoughness(inout PBRData data) {
      data.clearCoatRoughness = uClearCoatRoughness;
    }
  #endif

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
      // this normal is in world space
      data.clearCoatNormal = normalize(vec3(data.inverseViewMatrix * vec4(normalize(vNormalView), 0.0)));
    }
  #endif


  // IOR = 1.5, F0 = 0.04
  // as material is no longer in contact with air we calculate new IOR on the
  // clear coat and material interface
  vec3 f0ClearCoatToSurface(const vec3 f0) {
    return saturate(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998);
  }

  float clearCoatBRDF(const PBRData data, const vec3 h, float NoH, float LoH, out float Fcc) {
    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      float clearCoatNoH = saturate(dot(data.clearCoatNormal, h));
    #else
      float clearCoatNoH = NoH;
    #endif
    float D = D_GGX(data.clearCoatLinearRoughness, clearCoatNoH, h, data.normalWorld);
    float V = V_Kelemen(LoH);
    // air-polyurethane interface has IOR = 1.5 -> F0 = 0.04
    float F = F_Schlick(0.04, 1.0, LoH) * data.clearCoat;

    Fcc = F;
    return D * V * F;
  }
#endif
`;
