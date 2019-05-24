module.exports = /* glsl */ `
precision highp float;

varying vec2 vTexCoord0;

uniform sampler2D image;
uniform vec2 imageSize;

uniform float intensity;

float Brightness(vec3 c) {
  return max(max(c.r, c.g), c.b);
}

void main () {
  vec4 d = (1.0 / imageSize).xyxy * vec4(-1, -1, +1, +1);

  // vec4 color = vec4(0.0);
  // color += texture2D(image, vTexCoord0 + d.xy);
  // color += texture2D(image, vTexCoord0 + d.zy);
  // color += texture2D(image, vTexCoord0);
  // color += texture2D(image, vTexCoord0 + d.xw);
  // color += texture2D(image, vTexCoord0 + d.zw);
  // gl_FragColor = color / 5.0 * intensity;

  vec4 s1 = texture2D(image, vTexCoord0 + d.xy);
  vec4 s2 = texture2D(image, vTexCoord0 + d.zy);
  vec4 s3 = texture2D(image, vTexCoord0 + d.xw);
  vec4 s4 = texture2D(image, vTexCoord0 + d.zw);

  // Karis's luma weighted average (using brightness instead of luma)
  float s1w = 1.0 / (Brightness(s1.xyz) + 1.0);
  float s2w = 1.0 / (Brightness(s2.xyz) + 1.0);
  float s3w = 1.0 / (Brightness(s3.xyz) + 1.0);
  float s4w = 1.0 / (Brightness(s4.xyz) + 1.0);
  float one_div_wsum = 1.0 / (s1w + s2w + s3w + s4w);

  vec4 color = (s1 * s1w + s2 * s2w + s3 * s3w + s4 * s4w) * one_div_wsum;
  gl_FragColor = color * intensity;
}
`
