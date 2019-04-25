module.exports = /* glsl */`
#if NUM_SPOT_LIGHTS > 0

struct SpotLight {
  vec3 position;
  vec3 direction;
  vec4 color;
  float innerAngle;
  float angle;
  float range;
  mat4 projectionMatrix;
  mat4 viewMatrix;
  bool castShadows;
  float near;
  float far;
  float bias;
  vec2 shadowMapSize;
};

uniform SpotLight uSpotLights[NUM_SPOT_LIGHTS];
uniform sampler2D uSpotLightShadowMaps[NUM_SPOT_LIGHTS];

void EvaluateSpotLight(inout PBRData data, SpotLight light, sampler2D shadowMap) {
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0); // TODO: move in the vertex shader
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec3 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xyz / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = bool(light.castShadows) ? getShadow(shadowMap, light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far) : 1.0;

  if (illuminated > 0.0) {
    vec3 posToLight = light.position - data.positionWorld;

    float invSqrFalloff = 1.0 / pow(light.range, 2.0);
    float attenuation = getDistanceAttenuation(posToLight, invSqrFalloff);

    // TODO: luminous power to intensity
    float innerAngle = light.innerAngle;
    float cosOuter = cos(light.angle);
    float cosInner = cos(innerAngle);
    float cosOuterSquared = cosOuter * cosOuter;
    float scale = 1.0 / max(1.0 / 1024.0, cosInner - cosOuter);
    float offset = -cosOuter * scale;

    vec2 scaleOffset = vec2(scale, offset);
    attenuation *= getAngleAttenuation(-light.direction, normalize(posToLight), scaleOffset);

    Light l;
    l.l = normalize(posToLight);
    l.color = light.color;
    l.attenuation = attenuation;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`
