#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;
uniform sampler2D tex0;

void main() {
  vec4 color = texture2D(tex0, vTexCoord).rgba;
  if (color.a > 0.0) {
    color.rgb /= color.a;
  }

  gl_FragColor = color;
}
