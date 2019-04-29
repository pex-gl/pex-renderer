module.exports = /* glsl */`
attribute vec3 aPosition;
attribute vec2 aTexCoord0;

varying vec2 vTexCoord0;

void main() {
  gl_Position = vec4(aPosition, 1.0);
  vTexCoord0 = aTexCoord0;
}
`
