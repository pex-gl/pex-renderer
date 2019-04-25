module.exports = /* glsl */`
#if NUM_DIRECTIONAL_LIGHTS > 0

struct DirectionalLight {
  vec3 direction;
  vec4 color;
  mat4 projectionMatrix;
  mat4 viewMatrix;
  bool castShadows;
  float near;
  float far;
  float bias;
  vec2 shadowMapSize;
};

uniform DirectionalLight uDirectionalLights[NUM_DIRECTIONAL_LIGHTS];
uniform sampler2D uDirectionalLightShadowMaps[NUM_DIRECTIONAL_LIGHTS]; //TODO: is it ok to sample depth texture as sampler2D?

void EvaluateDirectionalLight(inout PBRData data, DirectionalLight light, int i) {
  // Shadows
  vec4 lightViewPosition = light.viewMatrix * vec4(vPositionWorld, 1.0);
  float lightDistView = -lightViewPosition.z;
  vec4 lightDeviceCoordsPosition = light.projectionMatrix * lightViewPosition;
  vec2 lightDeviceCoordsPositionNormalized = lightDeviceCoordsPosition.xy / lightDeviceCoordsPosition.w;
  float lightDeviceCoordsZ = lightDeviceCoordsPosition.z / lightDeviceCoordsPosition.w;
  vec2 lightUV = lightDeviceCoordsPositionNormalized.xy * 0.5 + 0.5;

  float illuminated = 0.0;

  if (light.castShadows) {
    if (i == 0) illuminated += directionalShadow(uDirectionalLightShadowMaps[0], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);

    #if NUM_DIRECTIONAL_LIGHTS >= 2
      if (i == 1) illuminated += directionalShadow(uDirectionalLightShadowMaps[1], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 3
      if (i == 2) illuminated += directionalShadow(uDirectionalLightShadowMaps[2], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 4
      if (i == 3) illuminated += directionalShadow(uDirectionalLightShadowMaps[3], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 5
      if (i == 4) illuminated += directionalShadow(uDirectionalLightShadowMaps[4], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 6
      if (i == 5) illuminated += directionalShadow(uDirectionalLightShadowMaps[5], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 7
      if (i == 6) illuminated += directionalShadow(uDirectionalLightShadowMaps[6], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
    #if NUM_DIRECTIONAL_LIGHTS >= 8
      if (i == 7) illuminated += directionalShadow(uDirectionalLightShadowMaps[7], light.shadowMapSize, lightUV, lightDistView - light.bias, light.near, light.far);
    #endif
  } else {
    illuminated = 1.0;
  }

  if (illuminated > 0.0) {
    Light l;
    l.l = -light.direction;
    l.color = light.color;
    l.attenuation = 1.0;
    getSurfaceShading(data, l, illuminated);
  }
}
#endif
`
