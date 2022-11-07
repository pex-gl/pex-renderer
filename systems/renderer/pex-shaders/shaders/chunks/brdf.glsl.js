export default /* glsl */ `
uniform float uReflectance;

// TODO: used by clearCoat
// https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf
// Distribution
// Walter et al. 2007, "Microfacet Models for Refraction through Rough Surfaces"
float D_GGX(float linearRoughness, float NoH, const vec3 h, const vec3 normalWorld) {
  float oneMinusNoHSquared = 1.0 - NoH * NoH;

  float a = NoH * linearRoughness;
  float k = linearRoughness / (oneMinusNoHSquared + a * a);
  float d = k * k * (1.0 / PI);
  return saturateMediump(d);
}

// TODO: Used by clearCoat
// Kelemen 2001, "A Microfacet Based Coupled Specular-Matte BRDF Model with Importance Sampling"
float V_Kelemen(float LoH) {
  return saturateMediump(0.25 / (LoH * LoH));
}


// TODO: used by clearCoat e.g. in indirect.glsl.js
float F_Schlick(float f0, float f90, float VoH) {
  return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
}

// Diffuse
float DiffuseLambert() {
  return 1.0 / PI;
}

// GGX, Trowbridge-Reitz
// Same as glTF2.0 PBR Spec
float MicrofacetDistribution(float linearRoughness, float NdotH) {
  float a2 = linearRoughness * linearRoughness;
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

// Smith Joint GGX
// Sometimes called Smith GGX Correlated
// Note: Vis = G / (4 * NdotL * NdotV)
// see Eric Heitz. 2014. Understanding the Masking-Shadowing Function in Microfacet-Based BRDFs. Journal of Computer Graphics Techniques, 3
// see Real-Time Rendering. Page 331 to 336.
// see https://google.github.io/filament/Filament.md.html#materialsystem/specularbrdf/geometricshadowing(specularg)
float VisibilityOcclusion(float linearRoughness, float NdotL, float NdotV) {
  float linearRoughnessSq = linearRoughness * linearRoughness;

  float GGXV = NdotL * sqrt(NdotV * NdotV * (1.0 - linearRoughnessSq) + linearRoughnessSq);
  float GGXL = NdotV * sqrt(NdotL * NdotL * (1.0 - linearRoughnessSq) + linearRoughnessSq);

  float GGX = GGXV + GGXL;
  if (GGX > 0.0) {
      return 0.5 / GGX;
  }
  return 0.0;
}

`;
