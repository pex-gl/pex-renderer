#ifdef GL_ES
precision highp float;
#endif
#pragma glslify: encode = require(./encode)
#pragma glslify: decode = require(./decode)
#pragma glslify: fxaa = require(glsl-fxaa)

uniform vec2 uScreenSize;

uniform sampler2D uOverlay;
uniform int uOverlayEncoding;

uniform float uExposure;
uniform int uOutputEncoding;

uniform bool uFXAA;

varying vec2 vTexCoord0;

void main() {
  vec4 color = vec4(0.0);
  if (uFXAA) {
    color = fxaa(uOverlay, vTexCoord0 * uScreenSize, uScreenSize);
  } else {
    color = texture2D(uOverlay, vTexCoord0);
  }
  color = decode(color, uOverlayEncoding);
  color.rgb *= uExposure;
  color.rgb = color.rgb / (1.0 + color.rgb);
  gl_FragColor = encode(color, uOutputEncoding);
}
