module.exports = /* glsl */`
#ifdef USE_REFLECTION_PROBES
  uniform sampler2D uReflectionMap;
  uniform int uReflectionMapEncoding;

  vec3 EnvBRDFApprox( vec3 SpecularColor, float Roughness, float NoV ) {
    const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022 );
    const vec4 c1 = vec4( 1.0, 0.0425, 1.04, -0.04 );
    vec4 r = Roughness * c0 + c1;
    float a004 = min( r.x * r.x, exp2( -9.28 * NoV ) ) * r.x + r.y;
    vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
    return SpecularColor * AB.x + AB.y;
  }

  vec3 getPrefilteredReflection(vec3 eyeDirWorld, vec3 normalWorld, float roughness) {
    float maxMipMapLevel = 5.0; //TODO: const
    vec3 reflectionWorld = reflect(-eyeDirWorld, normalWorld);
    // float lod = pow(roughness, 2.0) * maxMipMapLevel; // TODO: verify reflection probe blurring code
    float lod = pow(roughness, 1.5) * maxMipMapLevel;
    float upLod = floor(lod);
    float downLod = ceil(lod);
    vec3 a = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, upLod)), uReflectionMapEncoding).rgb;
    vec3 b = decode(texture2D(uReflectionMap, envMapOctahedral(reflectionWorld, 0.0, downLod)), uReflectionMapEncoding).rgb;
    return mix(a, b, lod - upLod);
  }

  void EvaluateLightProbe(inout PBRData data) {
    float NdotV = clamp( dot( data.normalWorld, data.eyeDirWorld ), 0.0, 1.0);
    vec3 reflectance = EnvBRDFApprox( data.specularColor, data.roughness, NdotV ); // TODO: roughness or alphaRoughness
    // No need to multiply by PI like three.jss as I'm already multiplying by PI in my convolution code
    vec3 irradianceColor = getIrradiance(data.normalWorld, uReflectionMap, uReflectionMapEncoding);
    vec3 reflectionColor = getPrefilteredReflection(data.eyeDirWorld, data.normalWorld, data.roughness); // TODO: roughness or alphaRoughness
    data.indirectDiffuse += data.diffuseColor * irradianceColor;
    data.indirectSpecular += reflectionColor * reflectance;
  }
#endif
`
