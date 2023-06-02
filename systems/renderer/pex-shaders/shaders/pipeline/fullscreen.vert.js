export default /* glsl */ `
attribute vec2 aPosition;
attribute vec2 aTexCoord0;

varying vec2 vTexCoord0;

void main() {
  vTexCoord0 = aTexCoord0;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;
