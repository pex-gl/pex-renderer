attribute vec4 aInstanceColor;
attribute vec4 aPosition;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform float uPointSize;
varying vec4 vColor;
void main() {
  vColor = aInstanceColor;
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
  gl_PointSize = uPointSize;
}
