module.exports = /* glsl */ `
#ifdef USE_REFLECTION_PROBES
  uniform sampler2D uReflectionMap;
  uniform int uReflectionMapEncoding;

  #define MAX_MIPMAP_LEVEL 5.0

  float computeSpecularAO(float NoV, float ao, float roughness) {
    #if defined(USE_AO) || defined(USE_OCCLUSION_MAP)
      return saturate(pow(NoV + ao, exp2(-16.0 * roughness - 1.0)) - 1.0 + ao);
    #else
      return 1.0;
    #endif
  }

  vec3 getPrefilteredReflection(vec3 reflected, float roughness) {
    // float lod = pow(roughness, 2.0) * MAX_MIPMAP_LEVEL; // TODO: verify reflection probe blurring code
    float lod = pow(roughness, 1.5) * MAX_MIPMAP_LEVEL;
    float upLod = floor(lod);
    float downLod = ceil(lod);

    vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, upLod)), uReflectionMapEncoding).rgb;
    vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, downLod)), uReflectionMapEncoding).rgb;

    return mix(a, b, lod - upLod);
  }

  vec3 EnvBRDFApprox( vec3 SpecularColor, float Roughness, float NoV ) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022 );
    const vec4 c1 = vec4( 1.0, 0.0425, 1.04, -0.04 );
    vec4 r = Roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
    vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
    return SpecularColor * AB.x + AB.y;
  }

  #if defined(USE_CLEAR_COAT)
    // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/clearcoat
    void evaluateClearCoatIBL(const PBRData data, float specularAO, inout vec3 Fd, inout vec3 Fr) {
      #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
        float clearCoatNoV = abs(dot(data.clearCoatNormal, data.viewWorld)) + FLT_EPS;
        vec3 clearCoatR = reflect(-data.viewWorld, data.clearCoatNormal);
      #else
        float clearCoatNoV = data.NdotV;
        vec3 clearCoatR = data.reflectionWorld;
      #endif
      // The clear coat layer assumes an IOR of 1.5 (4% reflectance)
      float Fc = F_Schlick(0.04, 1.0, clearCoatNoV) * uClearCoat;
      float attenuation = 1.0 - Fc;
      Fr *= (attenuation * attenuation);
      Fr += getPrefilteredReflection(clearCoatR, uClearCoatRoughness) * (specularAO * Fc);
      Fd *= attenuation;
    }
  #endif

  void EvaluateLightProbe(inout PBRData data, float ao) {
    // TODO
    float energyCompensation = 1.0;
    float diffuseBRDF = ao;
    float specularAO = computeSpecularAO(data.NdotV, ao, data.roughness);

    vec3 diffuseIrradiance = getIrradiance(data.normalWorld, uReflectionMap, uReflectionMapEncoding);
    vec3 Fd = data.diffuseColor * diffuseIrradiance * diffuseBRDF;

    vec3 prefilteredRadiance = getPrefilteredReflection(data.reflectionWorld, data.roughness);
    vec3 specularReflectance = EnvBRDFApprox(data.specularColor, data.roughness, data.NdotV);

    vec3 Fr = specularReflectance * prefilteredRadiance;
    Fr *= specularAO * energyCompensation;

    #ifdef USE_CLEAR_COAT
      evaluateClearCoatIBL(data, specularAO, Fd, Fr);
    #endif

    data.indirectDiffuse += Fd;
    data.indirectSpecular += Fr;
  }
#endif
`
