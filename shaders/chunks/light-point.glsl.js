module.exports = /* glsl */`
#if NUM_POINT_LIGHTS > 0

struct PointLight {
  vec3 position;
  vec4 color;
  float range;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];
uniform samplerCube uPointLightShadowMaps[NUM_POINT_LIGHTS];

void EvaluatePointLight(inout PBRData data, PointLight light, int i) {
  float illuminated = 1.0; // no shadows yet
  data.lightWorld = light.position - data.positionWorld;
  float dist = length(data.lightWorld);

  // TODO: hardcoded shadowmap index
  vec3 N = -normalize(data.lightWorld);
  float far = 10.0;
  float depth = unpackDepth(textureCube(uPointLightShadowMaps[0], N)) * far;
  // float depth = textureCube(uPointLightShadowMaps[0], N).r;
  if (dist - 0.05 > depth) {
    illuminated = 0.0;
  }
  // illuminated = (depth - dist);
  // illuminated = step(dist, depth / 2.0);

  // data.directDiffuse = vec3(fract(depth));
  // data.directDiffuse = vec3(fract(dist));
  // data.directDiffuse = vec3(illuminated);
  // return;

  if (illuminated > 0.0) {
    data.lightWorld /= dist;

    vec3 N = data.normalWorld;
    vec3 V = data.viewWorld;
    vec3 L = data.lightWorld;
    vec3 H = normalize(V + L);
    float NdotV = max(0.0, dot(N, V));

    data.NdotL = clamp(dot(N, L), 0.001, 1.0);
    data.HdotV = max(0.0, dot(H, V));
    data.NdotH = max(0.0, dot(N, H));
    data.LdotH = max(0.0, dot(L, H));

    vec3 F = SpecularReflection(data);
    float D = MicrofacetDistribution(data);
    float G = GeometricOcclusion(data);

    vec3 nominator = F * G * D;
    float denominator = 4.0 * data.NdotV * data.NdotL + 0.001;
    vec3 specularBrdf = nominator / denominator;

    vec3 lightColor = decode(light.color, 3).rgb;
    lightColor *= light.color.a; // intensity

    float distanceRatio = clamp(1.0 - pow(dist/light.range, 4.0), 0.0, 1.0);
    float falloff = (distanceRatio * distanceRatio) / (max(dist * dist, 0.01));

    //TODO: is irradiance the right name? Three.js is using it
    vec3 irradiance = data.NdotL * lightColor * illuminated;
    irradiance *= falloff;

    //TODO: (1 - F) comes from glTF spec, three.js doesn't have it? Schlick BRDF
    data.directDiffuse += (1.0 - F) * DiffuseLambert(data.diffuseColor) * irradiance;
    data.directSpecular += specularBrdf * irradiance;
  }
}
#endif
`
