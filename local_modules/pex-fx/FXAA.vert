float FXAA_SUBPIX_SHIFT = 1.0/4.0;

uniform float rtWidth;
uniform float rtHeight;
attribute vec2 aPosition;
attribute vec2 aTexCoord0;
varying vec4 posPos;

varying vec2 vTexCoord;

void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);

  vec2 rcpFrame = vec2(1.0/rtWidth, 1.0/rtHeight);
  posPos.xy = aTexCoord0.xy;
  posPos.zw = aTexCoord0.xy - (rcpFrame * (0.5 + FXAA_SUBPIX_SHIFT));
}
