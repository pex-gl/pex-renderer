module.exports = `
const float gamma_in = 2.2;

float toLinear(float v) {
  return pow(v, gamma_in);
}

vec2 toLinear(vec2 v) {
  return pow(v, vec2(gamma_in));
}

vec3 toLinear(vec3 v) {
  return pow(v, vec3(gamma_in));
}

vec4 toLinear(vec4 v) {
  return vec4(toLinear(v.rgb), v.a);
}
`
