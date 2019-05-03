module.exports = /* glsl */ `
attribute vec2 aPosition;
attribute vec2 aTexCoord0;

uniform vec4 uBounds; // x, y, width, height

varying vec2 vTexCoord;

void main() {
  vec2 pos = aPosition;
  pos = (pos + 1.0) / 2.0; // move from -1..1 to 0..1
  pos = vec2(
    uBounds.x + pos.x * uBounds.z,
    uBounds.y + pos.y * uBounds.w
  );
  pos = pos * 2.0 - 1.0;
  gl_Position = vec4(pos, 0.0, 1.0);
  vTexCoord = aTexCoord0;
}
`
