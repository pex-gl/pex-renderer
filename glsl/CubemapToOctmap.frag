#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: octMapUvToDir = require('./OctMapUVToDir.glsl')

varying vec2 vTexCoord;

uniform samplerCube uCubemap;
uniform float uTextureSize;

void main() {
  vec3 N = octMapUvToDir(vTexCoord, uTextureSize);
  gl_FragColor = textureCube(uCubemap, N);
}

