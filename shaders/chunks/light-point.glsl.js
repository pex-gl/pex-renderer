module.exports = /* glsl */`
#if NUM_POINT_LIGHTS > 0

struct PointLight {
  vec3 position;
  vec4 color;
  float range;
  bool castShadows;
};

uniform PointLight uPointLights[NUM_POINT_LIGHTS];
uniform samplerCube uPointLightShadowMaps[NUM_POINT_LIGHTS];

void EvaluatePointLight(inout PBRData data, PointLight light, samplerCube shadowMap) {
  float illuminated = 1.0; // no shadows yet
  data.lightWorld = light.position - data.positionWorld;
  float dist = length(data.lightWorld);

  if (light.castShadows) {
    vec3 N = -normalize(data.lightWorld);
    float far = 10.0;
    float depth = unpackDepth(textureCube(shadowMap, N)) * far;
    // float depth = textureCube(shadowMap, N).r;
    if (dist - 0.05 > depth) {
      illuminated = 0.0;
    }
    // illuminated = (depth - dist);
    // illuminated = step(dist, depth / 2.0);

    // data.directDiffuse = vec3(fract(depth));
    // data.directDiffuse = vec3(fract(dist));
    // data.directDiffuse = vec3(illuminated);
    // return;
  } else {
    illuminated = 1.0;
  }

  if (illuminated > 0.0) {
    vec3 posToLight = light.position - data.positionWorld;

    float invSqrFalloff = 1.0 / pow(light.range, 2.0);
    float attenuation = getDistanceAttenuation(posToLight, invSqrFalloff);

    Light l;
    l.l = normalize(posToLight);
    l.color = light.color;
    l.attenuation = attenuation;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`
