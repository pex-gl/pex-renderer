module.exports = `
// source http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec3 decodeRGBM (vec4 rgbm) {
  vec3 r = rgbm.rgb * (7.0 * rgbm.a);
  return r * r;
}
`
