module.exports = `
const float gamma_out = 2.2;

float toGamma(float v) {
  return pow(v, 1.0 / gamma_out);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma_out));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma_out));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}
`
