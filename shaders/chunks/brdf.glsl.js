module.exports = /* glsl */ `
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
// TODO: alphaRoughness = linearRoughness?
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
