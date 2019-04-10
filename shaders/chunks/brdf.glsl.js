module.exports = /* glsl */`
uniform float uReflectance;

// https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf
// Distribution
// Walter et al. 2007, "Microfacet Models for Refraction through Rough Surfaces"
float D_GGX(float linearRoughness, float NoH, const vec3 h) {
#if defined(TARGET_MOBILE)
  vec3 NxH = cross(shading_normal, h);
  float oneMinusNoHSquared = dot(NxH, NxH);
#else
  float oneMinusNoHSquared = 1.0 - NoH * NoH;
#endif

  float a = NoH * linearRoughness;
  float k = linearRoughness / (oneMinusNoHSquared + a * a);
  float d = k * k * (1.0 / PI);
  return saturateMediump(d);
}

// Burley 2012, "Physically-Based Shading at Disney"
float D_GGX_Anisotropic(float at, float ab, float ToH, float BoH, float NoH) {
  float a2 = at * ab;
  highp vec3 d = vec3(ab * ToH, at * BoH, a2 * NoH);
  highp float d2 = dot(d, d);
  float b2 = a2 / d2;
  return a2 * b2 * b2 * (1.0 / PI);
}

float distribution(float linearRoughness, float NoH, const vec3 h) {
  return D_GGX(linearRoughness, NoH, h);
}

float distributionAnisotropic(float at, float ab, float ToH, float BoH, float NoH) {
  return D_GGX_Anisotropic(at, ab, ToH, BoH, NoH);
}

float distributionClearCoat(float linearRoughness, float NoH, const vec3 h) {
  return D_GGX(linearRoughness, NoH, h);
}

// Visibility
// Heitz 2014, "Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs"
float V_SmithGGXCorrelated(float linearRoughness, float NoV, float NoL) {
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
float V_SmithGGXCorrelated_Fast(float linearRoughness, float NoV, float NoL) {
  float v = 0.5 / mix(2.0 * NoL * NoV, NoL + NoV, linearRoughness);
  return saturateMediump(v);
}

// Heitz 2014, "Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs"
float V_SmithGGXCorrelated_Anisotropic(float at, float ab, float ToV, float BoV, float ToL, float BoL, float NoV, float NoL) {
  float lambdaV = NoL * length(vec3(at * ToV, ab * BoV, NoV));
  float lambdaL = NoV * length(vec3(at * ToL, ab * BoL, NoL));
  float v = 0.5 / (lambdaV + lambdaL);
  return saturateMediump(v);
}

// Kelemen 2001, "A Microfacet Based Coupled Specular-Matte BRDF Model with Importance Sampling"
float V_Kelemen(float LoH) {
  return saturateMediump(0.25 / (LoH * LoH));
}

// Neubelt and Pettineo 2013, "Crafting a Next-gen Material Pipeline for The Order: 1886"
float V_Neubelt(float NoV, float NoL) {
  return saturateMediump(1.0 / (4.0 * (NoL + NoV - NoL * NoV)));
}

float visibility(float linearRoughness, float NoV, float NoL) {
  #if !defined(TARGET_MOBILE)
    return V_SmithGGXCorrelated(linearRoughness, NoV, NoL);
  #else
    return V_SmithGGXCorrelated_Fast(linearRoughness, NoV, NoL);
  #endif
}

float visibilityAnisotropic(float linearRoughness, float at, float ab, float ToV, float BoV, float ToL, float BoL, float NoV, float NoL) {
  #if !defined(TARGET_MOBILE)
    return V_SmithGGXCorrelated(linearRoughness, NoV, NoL);
  #else
    return V_SmithGGXCorrelated_Anisotropic(at, ab, ToV, BoV, ToL, BoL, NoV, NoL);
  #endif
}

float visibilityClearCoat(float roughness, float linearRoughness, float LoH) {
  return V_Kelemen(LoH);
}

// Fresnel
// Schlick 1994, "An Inexpensive BRDF Model for Physically-Based Rendering"
vec3 F_Schlick(const vec3 f0, float f90, float VoH) {
  return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
}

vec3 F_Schlick(const vec3 f0, float VoH) {
  float f = pow(1.0 - VoH, 5.0);
  return f + f0 * (1.0 - f);
}

float F_Schlick(float f0, float f90, float VoH) {
  return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
}

vec3 fresnel(const vec3 f0, float LoH) {
  #if defined(TARGET_MOBILE)
    return F_Schlick(f0, LoH); // f90 = 1.0
  #else
    float f90 = saturate(dot(f0, vec3(50.0 * 0.33)));
    return F_Schlick(f0, f90, LoH);
  #endif
}

// Diffuse
float DiffuseLambert() {
  return 1.0 / PI;
}

// Burley 2012, "Physically-Based Shading at Disney"
float DiffuseBurley(float linearRoughness, float NoV, float NoL, float LoH) {
  float f90 = 0.5 + 2.0 * linearRoughness * LoH * LoH;
  float lightScatter = F_Schlick(1.0, f90, NoL);
  float viewScatter  = F_Schlick(1.0, f90, NoV);
  return lightScatter * viewScatter * (1.0 / PI);
}
`
