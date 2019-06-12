module.exports = /* glsl */ `
#if NUM_AMBIENT_LIGHTS > 0

struct AmbientLight {
  vec4 color;
};

uniform AmbientLight uAmbientLights[NUM_AMBIENT_LIGHTS];

void EvaluateAmbientLight(inout PBRData data, AmbientLight light, float ao) {
  vec3 lightColor = decode(light.color, 3).rgb;
  lightColor *= light.color.a;
  data.indirectDiffuse += ao * (data.diffuseColor * lightColor);
}
#endif
`
