attribute vec2 aPosition;
attribute vec2 aTexCoord0;

varying vec2 vTexCoord;

uniform vec2 uOffset;
uniform vec2 uSize;

void main() {
  gl_Position = vec4(aPosition * uSize + uOffset - (1.0 - uSize), 0.0, 1.0);
  vTexCoord = aTexCoord0;
}
