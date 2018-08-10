module.exports = `
// source http://webglinsights.github.io/downloads/WebGL-Insights-Chapter-16.pdf
vec4 encodeRGBM (vec3 rgb) {
  vec4 r;
  r.xyz = (1.0 / 7.0) * sqrt(rgb);
  r.a = max(max(r.x, r.y), r.z);
  r.a = clamp(r.a, 1.0 / 255.0, 1.0);
  r.a = ceil(r.a * 255.0) / 255.0;
  r.xyz /= r.a;
  return r;
}
`
