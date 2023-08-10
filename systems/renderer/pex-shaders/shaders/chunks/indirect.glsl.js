export default /* glsl */ `
#ifdef USE_REFLECTION_PROBES
  uniform sampler2D uReflectionMap;
  uniform float uReflectionMapSize;
  uniform int uReflectionMapEncoding;

  #define MAX_MIPMAP_LEVEL 5.0

  vec3 getPrefilteredReflection(vec3 reflected, float roughness) {
    float MIN_ROUGHNESS = 0.089; //TODO: this is defined elsewhere as well but lower down in frag src
    float lod = (roughness - MIN_ROUGHNESS)/(1.0 - MIN_ROUGHNESS) * MAX_MIPMAP_LEVEL;
    float upLod = floor(lod);
    float downLod = ceil(lod);

    vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, upLod, uReflectionMapSize)), uReflectionMapEncoding).rgb;
    vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflected, 0.0, downLod, uReflectionMapSize)), uReflectionMapEncoding).rgb;

    float sampleLod = lod - upLod;
    return mix(a, b, sampleLod);
  }

  vec3 EnvBRDFApprox( vec3 specularColor, float roughness, float NoV, out float fabx, out float faby ) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022 );
    const vec4 c1 = vec4( 1.0, 0.0425, 1.04, -0.04 );
    vec4 r = roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
    vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
    fabx = AB.x;
    faby = AB.y;
    return specularColor * AB.x + AB.y;
  }

  vec3 EnvBRDFApprox( vec3 specularColor, float roughness, float NoV) {
    float x;
    float y;
    return EnvBRDFApprox(specularColor, roughness, NoV, x, y);
  }

  #if defined(USE_CLEAR_COAT)
    // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/clearcoat
    void evaluateClearCoatIBL(const PBRData data, float ao, inout vec3 Fd, inout vec3 Fr) {
      #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
        float clearCoatNoV = abs(dot(data.clearCoatNormal, data.viewWorld)) + FLT_EPS;
        vec3 clearCoatR = reflect(-data.viewWorld, data.clearCoatNormal);
      #else
        float clearCoatNoV = data.NdotV;
        vec3 clearCoatR = data.reflectionWorld;
      #endif
      // The clear coat layer assumes an IOR of 1.5 (4% reflectance)
      float Fc = F_Schlick(0.04, 1.0, clearCoatNoV) * data.clearCoat;
      float attenuation = 1.0 - Fc;
      Fr *= (attenuation * attenuation);
      Fr += getPrefilteredReflection(clearCoatR, data.clearCoatRoughness) * (ao * Fc);
      Fd *= attenuation;
    }
  #endif

  void EvaluateLightProbe(inout PBRData data, float ao) {
    // TODO: energyCompensation
    float energyCompensation = 1.0;

    vec3 diffuseIrradiance = getIrradiance(data.normalWorld, uReflectionMap, uReflectionMapSize, uReflectionMapEncoding);
    vec3 Fd = data.diffuseColor * diffuseIrradiance * ao;

    float f_abx = 0.0;
    float f_aby = 0.0;
    vec3 specularReflectance = EnvBRDFApprox(data.f0, data.roughness, data.NdotV, f_abx, f_aby);
    vec3 prefilteredRadiance = getPrefilteredReflection(data.reflectionWorld, data.roughness);

    vec3 Fr = specularReflectance * prefilteredRadiance * ao;
    Fr *= energyCompensation;

    // vec3 Fs = EvaluateSheen(data, NdotH, data.NdotV, NdotL);
    vec3 sheenReflectance = EnvBRDFApprox(data.sheenColor, data.sheenRoughness, data.NdotV);
    vec3 sheenRadiance = getPrefilteredReflection(data.reflectionWorld, data.sheenRoughness);
    // vec3 Fs = sheenRadiance + sheenReflectance * ao;
    vec3 Fs = vec3(0.0);
    data.sheen += Fs;



    // Roughness dependent fresnel, from Fdez-Aguera
    vec3 Fr2 = max(vec3(1.0 - data.roughness), data.f0) - data.f0;

    // k_S = F0 + Fr * pow(1.0 - NoV, 5.0);
    vec3 k_S = data.f0 + Fr2 * pow(1.0 - data.NdotV, 5.0);


    vec3 FssEss = k_S * f_abx + f_aby;

    // https://bruop.github.io/ibl/
    // Multiple scattering, from Fdez-Aguera
    float Ems = (1.0 - (f_abx + f_aby));
    vec3 F_avg = data.f0 + (1.0 - data.f0) / 21.0;
    vec3 FmsEms = Ems * FssEss * F_avg / (1.0 - F_avg * Ems);
    vec3 k_D = data.diffuseColor * (1.0 - FssEss - FmsEms);
    vec3 color = FssEss * prefilteredRadiance + (FmsEms + k_D) * diffuseIrradiance;

    #ifdef USE_CLEAR_COAT
      evaluateClearCoatIBL(data, ao, Fd, Fr);
    #endif

    data.indirectSpecular += color;
    // data.indirectDiffuse += Fd;
    // data.indirectDiffuse += Fr;
    data.indirectSpecular += Fs; //multiscattering here?
  }
#endif
`;
