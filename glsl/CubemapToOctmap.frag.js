const OctMapUVToDir = require('./OctMapUVToDir.glsl.js')

module.exports = `
#ifdef GL_ES
precision highp float;
#endif

${OctMapUVToDir}

varying vec2 vTexCoord;

uniform samplerCube uCubemap;
uniform float uTextureSize;

void main() {
  vec3 N = octMapUVToDir(vTexCoord, uTextureSize);
  gl_FragColor = textureCube(uCubemap, N);
}
`
