#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform sampler2D tex1;

void main() {
  vec4 color = texture2D(tex0, vTexCoord);
  vec4 color2 = texture2D(tex1, vTexCoord);

  gl_FragColor = color * color2;
}
