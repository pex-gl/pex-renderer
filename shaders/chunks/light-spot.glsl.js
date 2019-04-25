module.exports = /* glsl */`
#if NUM_SPOT_LIGHTS > 0

struct SpotLight {
    vec3 position;
    vec3 direction;
    vec4 color;
    float innerAngle;
    float angle;
    float range;
};

uniform SpotLight uSpotLights[NUM_SPOT_LIGHTS];

void EvaluateSpotLight(inout PBRData data, SpotLight light, int i) {
  float illuminated = 1.0; // no shadows yet

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
