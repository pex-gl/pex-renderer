module.exports = /* glsl */ `
struct Light {
  vec3 l;
  vec4 color;
  float attenuation;
};

// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float getDistanceAttenuation(const highp vec3 posToLight, float falloff) {
  // Square Falloff Attenuation
  float distanceSquare = dot(posToLight, posToLight);
  float factor = distanceSquare * falloff;
  float smoothFactor = saturate(1.0 - factor * factor);
  float attenuation = smoothFactor * smoothFactor;

  return attenuation * 1.0 / max(distanceSquare, 1e-4);
}

float getAngleAttenuation(const vec3 lightDir, const vec3 l, const vec2 scaleOffset) {
  float cd = dot(lightDir, l);
  float attenuation  = saturate(cd * scaleOffset.x + scaleOffset.y);
  return attenuation * attenuation;
}

void getSurfaceShading(inout PBRData data, Light light, float illuminated) {
  vec3 N = data.normalWorld;
  vec3 V = data.viewWorld;
  vec3 L = normalize(light.l);
  vec3 H = normalize(V + L);

  float NdotV = saturate(abs(dot(N, V)) + FLT_EPS);
  float NdotL = saturate(dot(N, L));

  if (NdotL <= 0.0) return;

  float NdotH = saturate(dot(N, H));
  float LdotH = saturate(dot(L, H));
  float HdotV = max(0.0, dot(H, V));

  // TODO: decide on F0 vs specularColor
  vec3 F = SpecularReflection(data.specularColor, HdotV);
  
  float D = MicrofacetDistribution(data.linearRoughness, NdotH);
  float G = GeometricOcclusion(data.linearRoughness, NdotL, NdotV);

  //TODO: which bug is this epsilon fixing?
  float denominator = 4.0 * NdotV * NdotL + 0.001;
  float Vis = G / denominator;

  //TODO: switch to linear colors
  vec3 lightColor = decode(light.color, 3).rgb;

  vec3 Fd = DiffuseLambert() * data.diffuseColor;
  vec3 Fr = F * Vis * D;

  //TODO: energy compensation
  float energyCompensation = 1.0;
  
  #ifdef USE_CLEAR_COAT
    float Fcc;
    float clearCoat = clearCoatLobe(data, H, NdotH, LdotH, Fcc);
    float attenuation = 1.0 - Fcc;

    // direct light still uses NdotL but clear coat needs separate dot product when using normal map
    // TODO: is "if defined(USE_NORMAL_MAP)" needed? in that case original N will be already modified so clearCoatNoL == NdotL, isn't it?
    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      vec3 color = (Fd + Fr * (energyCompensation * attenuation)) * attenuation * NdotL;

      float clearCoatNoL = saturate(dot(data.clearCoatNormal, light.l));
      color += clearCoat * clearCoatNoL;

      data.directColor += (color * lightColor) * (light.color.w * light.attenuation * illuminated);
      return;
    #else
      vec3 color = (Fd + Fr * (energyCompensation * attenuation)) * attenuation + clearCoat;
    #endif
  #else
    vec3 color = Fd + Fr * energyCompensation;
  #endif

  data.directColor += (color * lightColor) * (light.color.a * light.attenuation * NdotL * illuminated);
}

void getSurfaceShadingFilament(inout PBRData data, Light light, float illuminated) {
  vec3 N = data.normalWorld;
  vec3 V = data.viewWorld;
  vec3 L = normalize(light.l);
  vec3 H = normalize(V + L);

  float NdotV = saturate(abs(dot(N, V)) + FLT_EPS);
  float NdotL = saturate(dot(N, L));

  if (NdotL <= 0.0) return;

  float NdotH = saturate(dot(N, H));
  float LdotH = saturate(dot(L, H));

  float D = Filament_distribution(data.linearRoughness, NdotH, H, data.normalWorld);
  float G = Filament_visibility(data.linearRoughness, NdotV, NdotL);
  vec3 F = Filament_fresnel(data.f0, LdotH);

  vec3 lightColor = decode(light.color, 3).rgb;

  vec3 Fd = DiffuseLambert() * data.diffuseColor;
  // vec3 Fd = DiffuseBurley(data.linearRoughness, NdotV, NdotL, LdotH) * data.diffuseColor;
  vec3 Fr = (D * G) * F;
  // TODO
  float energyCompensation = 1.0;

  #ifdef USE_CLEAR_COAT
    float Fcc;
    float clearCoat = clearCoatLobe(data, H, NdotH, LdotH, Fcc);
    float attenuation = 1.0 - Fcc;

    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      vec3 color = (Fd + Fr * (energyCompensation * attenuation)) * attenuation * NdotL;

      float clearCoatNoL = saturate(dot(data.clearCoatNormal, light.l));
      color += clearCoat * clearCoatNoL;

      data.directColor += (color * lightColor) * (light.color.w * light.attenuation * illuminated);
      return;
    #else
      vec3 color = (Fd + Fr * (energyCompensation * attenuation)) * attenuation + clearCoat;
    #endif
  #else
    vec3 color = Fd + Fr * energyCompensation;
  #endif

  data.directColor += (color * lightColor) * (light.color.a * light.attenuation * NdotL * illuminated);
}
`
