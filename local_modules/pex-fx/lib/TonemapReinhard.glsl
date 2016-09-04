#ifdef VERT

attribute vec2 position;
attribute vec2 texCoord;
varying vec2 vTexCoord;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
  vTexCoord = texCoord;
}

#endif

#ifdef FRAG

varying vec2 vTexCoord;
uniform float exposure;
uniform sampler2D tex0;

void main() {
  vec4 color = texture2D(tex0, vTexCoord).rgba;
  color.rgb *= exposure;
  color = color/(1.0 + color);
  vec3 retColor = color.rgb;
  gl_FragColor.rgb = retColor;
  gl_FragColor.a = color.a;
}

#endif