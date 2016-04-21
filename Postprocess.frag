#ifdef GL_ES
precision highp float;
#define GLSLIFY 1
#endif

//Based on Filmic Tonemapping Operators http://filmicgames.com/archives/75
vec3 tonemapFilmic(vec3 color) {
    vec3 x = max(vec3(0.0), color - 0.004);
    return (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);
}

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

uniform sampler2D tex0;
uniform float uExposure;

varying vec2 vTexCoord;

void main() {
    vec3 color = texture2D(tex0, vTexCoord).rgb;
    color *= uExposure;
    color = tonemapFilmic(color); //filmic has built-in gamma
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
