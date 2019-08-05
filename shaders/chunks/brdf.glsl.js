module.exports = /* glsl */ `
uniform float uReflectance;

// TODO: used by clearCoat
// https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf
// Distribution
// Walter et al. 2007, "Microfacet Models for Refraction through Rough Surfaces"
float D_GGX(float linearRoughness, float NoH, const vec3 h, const vec3 normalWorld) {
#if defined(TARGET_MOBILE)
  vec3 NxH = cross(normalWorld, h);
  float oneMinusNoHSquared = dot(NxH, NxH);
#else
  float oneMinusNoHSquared = 1.0 - NoH * NoH;
#endif

  float a = NoH * linearRoughness;
  float k = linearRoughness / (oneMinusNoHSquared + a * a);
  float d = k * k * (1.0 / PI);
  return saturateMediump(d);
}

float Filament_distribution(float linearRoughness, float NoH, const vec3 h, const vec3 normalWorld) {
  return D_GGX(linearRoughness, NoH, h, normalWorld);
}

// TODO: used by clearCoat
float distributionClearCoat(float linearRoughness, float NoH, const vec3 h, const vec3 normalWorld) {
  return D_GGX(linearRoughness, NoH, h, normalWorld);
}

// Visibility
// Heitz 2014, "Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs"
float Filament_V_SmithGGXCorrelated(float linearRoughness, float NoV, float NoL) {
  float a2 = linearRoughness * linearRoughness;
  float lambdaV = NoL * sqrt((NoV - a2 * NoV) * NoV + a2);
  float lambdaL = NoV * sqrt((NoL - a2 * NoL) * NoL + a2);
  float v = 0.5 / (lambdaV + lambdaL);
  // a2=0 => v = 1 / 4*NoL*NoV   => min=1/4, max=+inf
  // a2=1 => v = 1 / 2*(NoL+NoV) => min=1/4, max=+inf
  // clamp to the maximum value representable in mediump
  return saturateMediump(v);
}

// Hammon 2017, "PBR Diffuse Lighting for GGX+Smith Microsurfaces"
float Filament_V_SmithGGXCorrelated_Fast(float linearRoughness, float NoV, float NoL) {
  float v = 0.5 / mix(2.0 * NoL * NoV, NoL + NoV, linearRoughness);
  return saturateMediump(v);
}

// TODO: Used by clearCoat
// Kelemen 2001, "A Microfacet Based Coupled Specular-Matte BRDF Model with Importance Sampling"
float V_Kelemen(float LoH) {
  return saturateMediump(0.25 / (LoH * LoH));
}

// Neubelt and Pettineo 2013, "Crafting a Next-gen Material Pipeline for The Order: 1886"
float Filament_V_Neubelt(float NoV, float NoL) {
  return saturateMediump(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));
}

float Filament_visibility(float linearRoughness, float NoV, float NoL) {
  #if !defined(TARGET_MOBILE)
    return Filament_V_SmithGGXCorrelated(linearRoughness, NoV, NoL);
  #else
    return Filament_V_SmithGGXCorrelated_Fast(linearRoughness, NoV, NoL);
  #endif
}

// TODO: Used by clearCoat
float visibilityClearCoat(float roughness, float linearRoughness, float LoH) {
  return V_Kelemen(LoH);
}

// Fresnel
// Schlick 1994, "An Inexpensive BRDF Model for Physically-Based Rendering"
vec3 Filament_F_Schlick(const vec3 f0, float f90, float VoH) {
  return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
}

vec3 Filament_F_Schlick(const vec3 f0, float VoH) {
  float f = pow(1.0 - VoH, 5.0);
  return f + f0 * (1.0 - f);
}

// TODO: used by clearCoat e.g. in indirect.glsl.js
float F_Schlick(float f0, float f90, float VoH) {
  return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
}

vec3 Filament_fresnel(const vec3 f0, float LoH) {
  #if defined(TARGET_MOBILE)
    return Filament_F_Schlick(f0, LoH); // f90 = 1.0
  #else
    float f90 = saturate(dot(f0, vec3(50.0 * 0.33)));
    return Filament_F_Schlick(f0, f90, LoH);
  #endif
}

// Diffuse
float DiffuseLambert() {
  return 1.0 / PI;
}

// Burley 2012, "Physically-Based Shading at Disney"
float Filament_DiffuseBurley(float linearRoughness, float NoV, float NoL, float LoH) {
  float f90 = 0.5 + 2.0 * linearRoughness * LoH * LoH;
  float lightScatter = F_Schlick(1.0, f90, NoL);
  float viewScatter  = F_Schlick(1.0, f90, NoV);
  return lightScatter * viewScatter * (1.0 / PI);
}

// OLD BACK PORT


// GGX, Trowbridge-Reitz
// Same as glTF2.0 PBR Spec
// TODO: alphaRoughness = linearRoughness
float MicrofacetDistribution(float alphaRoughness, float NdotH) {
  float a2 = alphaRoughness * alphaRoughness;
  float NdotH2 = NdotH * NdotH;

  float nom = a2;
  float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  if (denom > 0.0) {
    return nom / denom;
  } else {
    return 1.0;
  }
}

// FresnelSchlick
// Same as glTF2.0 PBR Spec
vec3 SpecularReflection(vec3 specularColor, float HdotV) {
  float cosTheta = HdotV;
  return specularColor + (1.0 - specularColor) * pow(1.0 - cosTheta, 5.0);
}

// TODO: rename alpha roughness to linear roughness
// Smith G
float GeometricOcclusion(float alphaRoughness, float NdotL, float NdotV) {
  float r = alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}
`
