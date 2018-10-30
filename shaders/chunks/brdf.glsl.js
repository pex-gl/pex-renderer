module.exports = /* glsl */`
// FresnelSchlick
vec3 SpecularReflection(PBRData data) {
  float cosTheta = data.HdotV;
  return data.specularColor + (1.0 - data.specularColor) * pow(1.0 - cosTheta, 5.0);
}

// Smith G
float GeometricOcclusion(PBRData data) {
  float NdotL = data.NdotL;
  float NdotV = data.NdotV;
  float r = data.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}

// GGX
float MicrofacetDistribution(PBRData data) {
  float a2 = data.alphaRoughness * data.alphaRoughness;
  float NdotH2 = data.NdotH * data.NdotH;

  float nom = a2;
  float denom  = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;

  if (denom > 0.0) {
    return nom / denom;
  } else {
    return 1.0;
  }
}

// DiffuseLambert
vec3 DiffuseLambert(vec3 color) {
  return color / PI;
}
`
