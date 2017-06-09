#pragma glslify: toLinear = require(glsl-gamma/in)
uniform float       uFogDensity;

uniform float       uSunDispertion;
uniform float       uSunIntensity;
uniform vec3        uInscatteringCoeffs;
uniform vec3        uFogColor;

// Fog adapted from from Iñigo Quilez article on fog
// http://www.iquilezles.org/www/articles/fog/fog.htm
vec4 fog(vec3 rgb, float dist, vec3 rayDir, vec3 sunDir) {
  vec3 sunColor = toLinear(vec3(0.98, 0.98, 0.7));
  vec3 fogColor = toLinear(uFogColor).rgb;

  float minSc         = 0.02;
  float density       = -(dist+1.0) * uFogDensity * 0.15 - dist * 0.0025;
  float sunAmount     = pow(max(dot(rayDir, sunDir), 0.0), 1.0 / (0.008 + uSunDispertion*3.0));
  sunAmount           = uSunIntensity * 10.0 * pow(sunAmount,10.0);
  sunAmount           = max(0.0, min(sunAmount, 1.0));
  vec3 sunFogColor    = mix(fogColor, sunColor, sunAmount);
  vec3 insColor       = vec3(1.0) - clamp( vec3(
        exp(density*(uInscatteringCoeffs.x+minSc)),
        exp(density*(uInscatteringCoeffs.y+minSc)),
        exp(density*(uInscatteringCoeffs.z+minSc))),
      vec3(0), vec3(1));

  return vec4(mix(rgb, sunFogColor, insColor), 1.0);
}

#pragma glslify: export(fog)
