module.exports = `
#ifdef GL_ES
precision highp float;
#endif
varying vec3 vNormalView;
void main() {
  gl_FragColor = vec4(vNormalView * 0.5 + 0.5, 1.0);
}
`
