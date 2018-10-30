module.exports = /* glsl */`
#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

const float gamma = 2.2;

// Linear
float toLinear(float v) {
  return pow(v, gamma);
}

vec2 toLinear(vec2 v) {
  return pow(v, vec2(gamma));
}

vec3 toLinear(vec3 v) {
  return pow(v, vec3(gamma));
}

vec4 toLinear(vec4 v) {
  return vec4(toLinear(v.rgb), v.a);
}

// Gamma
float toGamma(float v) {
  return pow(v, 1.0 / gamma);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}

// source http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec3 decodeRGBM (vec4 rgbm) {
  vec3 r = rgbm.rgb * (7.0 * rgbm.a);
  return r * r;
}

vec4 encodeRGBM (vec3 rgb_0) {
  vec4 r;
  r.xyz = (1.0 / 7.0) * sqrt(rgb_0);
  r.a = max(max(r.x, r.y), r.z);
  r.a = clamp(r.a, 1.0 / 255.0, 1.0);
  r.a = ceil(r.a * 255.0) / 255.0;
  r.xyz /= r.a;
  return r;
}

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
}
`
