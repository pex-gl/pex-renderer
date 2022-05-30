export default /* glsl */ `
float readDepth(const in sampler2D depthMap, const in vec2 coord, const in float near, const in float far) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
  return z_e;
}
`;
