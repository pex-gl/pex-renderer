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

  float D = distribution(data.linearRoughness, NdotH, H, data.normalWorld);
  float G = visibility(data.linearRoughness, NdotV, NdotL);
  vec3 F = fresnel(data.f0, LdotH);

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
