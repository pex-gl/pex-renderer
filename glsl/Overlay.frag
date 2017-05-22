#ifdef GL_ES
precision highp float;
#endif
#pragma glslify: encode = require(./encode)
#pragma glslify: decode = require(./decode)

uniform vec2 uScreenSize;

uniform sampler2D uOverlay;
uniform int uOverlayEncoding;

uniform float uExposure;
uniform int uOutputEncoding;

varying vec2 vTexCoord0;

void main() {
  vec4 color = decode(texture2D(uOverlay, vTexCoord0), uOverlayEncoding);
  color.rgb *= uExposure;
  color.rgb = color.rgb / (1.0 + color.rgb);
  gl_FragColor = encode(color, uOutputEncoding);
}
