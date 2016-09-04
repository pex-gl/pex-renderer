#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform sampler2D image;
uniform vec2 imageSize;

void main() {
  vec2 texel = vec2(1.0 / imageSize.x, 1.0 / imageSize.y);

  vec4 color = vec4(0.0);
  color += 0.25 * texture2D(image, vTexCoord + vec2(texel.x * -1.0, 0.0));
  color += 0.50 * texture2D(image, vTexCoord);
  color += 0.25 * texture2D(image, vTexCoord + vec2(texel.x *  1.0, 0.0));
  gl_FragColor = color;
}
