#ifdef GL_ES
precision highp float;
#define GLSLIFY 1
#endif

const float gamma = 2.2;

float toGamma(float v) {
  return pow(v, 1.0 / gamma);
}

vec2 toGamma(vec2 v) {
  return pow(v, vec2(1.0 / gamma));
}

vec3 toGamma(vec3 v) {
  return pow(v, vec3(1.0 / gamma));
}

vec4 toGamma(vec4 v) {
  return vec4(toGamma(v.rgb), v.a);
}

varying vec2 vTexCoord;
uniform sampler2D tex0;

void main() {
    vec4 color = texture2D(tex0, vTexCoord).rgba;
    //premultiplied linear
    //http://ssp.impulsetrain.com/gamma-premult.html
    gl_FragColor.rgb = toGamma(color.rgb/color.a)*color.a;
    gl_FragColor.a = color.a;
}
