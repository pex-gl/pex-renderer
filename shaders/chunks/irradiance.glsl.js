module.exports = /* glsl */ `
vec3 getIrradiance(vec3 normalWorld, sampler2D map, int encoding) {
  vec2 uv = envMapOctahedral(normalWorld);
  float width = 2048.0;
  float irrSize = 64.0;
  uv += 0.5 / irrSize;
  uv /= irrSize / (irrSize - 1.0);
  uv = (uv * irrSize + vec2(2048.0 - irrSize)) / width;
  return decode(texture2D(map, uv), encoding).rgb;
}
`
