export default /* glsl */ `
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

vec2 compensateStretch(vec2 uv) {
  return uv;
  // float u = uv.x;
  // u = (u - 0.5) * 1.1 + 0.5;
  // return vec2(u, uv.y);
}


void getSurfaceShading(inout PBRData data, Light light, float illuminated) {
  vec3 N = data.normalWorld;
  vec3 V = data.viewWorld;
  vec3 L = normalize(light.l);
  vec3 H = normalize(V + L);

  float NdotV = saturate(abs(dot(N, V)) + FLT_EPS);
  float NdotL = saturate(dot(N, L));

  #ifndef USE_TRANSMISSION
  if (NdotL <= 0.0) return;
  #endif

  float NdotH = saturate(dot(N, H));
  float LdotH = saturate(dot(L, H));
  float HdotV = max(0.0, dot(H, V));

  vec3 F = SpecularReflection(data.f0, HdotV);

  float D = MicrofacetDistribution(data.linearRoughness, NdotH);
  float Vis = VisibilityOcclusion(data.linearRoughness, NdotL, NdotV);

  //TODO: switch to linear colors
  vec3 lightColor = decode(light.color, 3).rgb;

  vec3 Fd = DiffuseLambert() * data.diffuseColor;
  vec3 Fr = F * Vis * D;
  vec3 Fs = vec3(0.0);

  //TODO: energy compensation
  float energyCompensation = 1.0;

  #ifdef USE_SHEEN
    Fs = EvaluateSheen(data, NdotH, NdotV, NdotL);
  #endif

  #ifdef USE_CLEAR_COAT
    float Fcc;
    float clearCoat = clearCoatBRDF(data, H, NdotH, LdotH, Fcc);
    float attenuation = 1.0 - Fcc;

    vec3 color = (Fs + Fd + Fr * (energyCompensation * attenuation)) * attenuation * NdotL;

    // direct light still uses NdotL but clear coat needs separate dot product when using normal map
    // if only normal map is present not clear coat normal map, we will get smooth coating on top of bumpy surface
    #if defined(USE_NORMAL_MAP) || defined(USE_CLEAR_COAT_NORMAL_MAP)
      float clearCoatNoL = saturate(dot(data.clearCoatNormal, light.l));
      color += clearCoat * clearCoatNoL;
    #else
      color += clearCoat * NdotL;
    #endif
  #else
    vec3 color = (Fs + Fd + Fr * energyCompensation) * NdotL;
  #endif



  data.directColor += (color * lightColor) * (light.color.a * light.attenuation * illuminated);

  #ifdef USE_TRANSMISSION
  // data.directDiffuse = texture2D(uCaptureTexture, gl_FragCoord.xy / uScreenSize.xy).rgb;

  float uIOR = 1.0;
  vec3 IoR_Values = mix(vec3(1.0), vec3(1.14, 1.12, 1.10), uIOR);

  vec3 incident = normalize(data.eyeDirWorld);

  float f = F_Schlick(0.04, 1.0, abs(dot(data.viewWorld, data.normalWorld)));

  vec3 refractColor = vec3(0.0);
  // #ifdef USE_REFLECTION_PROBES
  // refractColor.x = texture2D(uEnvMap, envMapEquirect(refract(incident, normalWorld, IoR_Values.x))).x;
  // refractColor.y = texture2D(uEnvMap, envMapEquirect(refract(incident, normalWorld, IoR_Values.y))).y;
  // refractColor.z = texture2D(uEnvMap, envMapEquirect(refract(incident, normalWorld, IoR_Values.z))).z;
  // #endif
  float refractAmount = uRefraction;

  vec3 reflectColor = vec3(0.0);

  #ifdef USE_REFLECTION_PROBES
  // reflectColor = texture2D(uReflectionMap, envMapOctahedral(reflect(-data.viewWorld, data.normalWorld), 0.0, 0.0)).rgb;
  #endif

  // vec3 IoR_Values = mix(vec3(1.0), vec3(1.14, 1.12, 1.10), uIOR);
  float level = clamp(data.roughness + (1.0 - data.opacity), 0.0, 1.0) * 5.0; //Opacity Hack
  vec2 uv = gl_FragCoord.xy / uScreenSize.xy;
  vec2 refractionAspect = vec2(1.0 * uScreenSize.y/uScreenSize.x, 1.0);
  refractColor.x = texture2DLodEXT(uCaptureTexture, compensateStretch(uv + refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.x).xy), level).x;
  refractColor.y = texture2DLodEXT(uCaptureTexture, compensateStretch(uv + refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.y).xy), level).y;
  refractColor.z = texture2DLodEXT(uCaptureTexture, compensateStretch(uv + refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.z).xy), level).z;
  // refractColor.x = texture2D(uCaptureTexture, compensateStretch(uv + refractionAspect * refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.x).xy)).x;
  // refractColor.y = texture2D(uCaptureTexture, compensateStretch(uv + refractionAspect * refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.y).xy)).y;
  // refractColor.z = texture2D(uCaptureTexture, compensateStretch(uv + refractionAspect * refractAmount * refract(incident, data.normalWorld, 1.0 / IoR_Values.z).xy)).z;

  data.directColor *= 0.3;
  data.directColor += data.diffuseColor * mix(refractColor, reflectColor, f);
  // data.directColor = vec3(uScreenSize.xy, 0.0);
  // data.directColor += refractColor;
  // data.directColor = vec3(f);
  // data.directColor = reflectColor;
  // data.directColor = 0.2 + texture2D(uCaptureTexture, uv).rgb;
  // data.directColor = vec3(uv, 1.0);
  // data.directColor = vec3(1.0, 0.0, 1.0);
  // data.directColor = texture2D(uCaptureTexture, uv).xyz;
  #endif
}
`;
