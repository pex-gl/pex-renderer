import SHADERS from "../chunks/index.js";

export default /* glsl */ `
precision highp float;

${SHADERS.octMapUvToDir}

varying vec2 vTexCoord;

uniform samplerCube uCubemap;
uniform float uTextureSize;

void main() {
  vec3 N = octMapUVToDir(vTexCoord, uTextureSize);
  gl_FragColor = textureCube(uCubemap, N);
}
`;
