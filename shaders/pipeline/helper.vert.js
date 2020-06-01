module.exports = /* glsl */ `
  attribute vec3 aPosition;
  attribute vec4 aVertexColor;

  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;

  varying vec4 vColor;

  void main () {
    vColor = aVertexColor;
    gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
  }
`
