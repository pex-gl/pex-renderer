#ifdef GL_ES
precision highp float;
#endif
#pragma glslify: decodeRGBM = require(../local_modules/glsl-rgbm/decode)
#pragma glslify: toGamma = require(glsl-gamma/out)
#pragma glslify: toLinear = require(glsl-gamma/in)

uniform vec2 uScreenSize;
uniform sampler2D uOverlay;
uniform float uExposure;
uniform bool uRGBM;
// uniform bool uHDR;

varying vec2 vTexCoord0;

void main() {
  vec3 color;
  if (uRGBM) {
    // if (uHDR) {
      // vec3 color = decodeRGBM(texture2D(uOverlay, vTexCoord0));
      color = decodeRGBM(texture2D(uOverlay, vTexCoord0));
      color *= uExposure;
      color = color / (1.0 + color);
      color = toGamma(color);
      // gl_FragColor = vec4(color, 1.0);
    // } else {
      // vec3 color = texture2D(uOverlay, vTexCoord0).rgb;
    // }
  } else {
    color = texture2D(uOverlay, vTexCoord0).rgb;
  }
  gl_FragColor = vec4(color, 1.0);
}
