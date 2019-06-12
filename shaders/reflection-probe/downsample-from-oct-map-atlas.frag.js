const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */ `
precision highp float;

${SHADERS.octMapUvToDir}
${SHADERS.octMap}

varying vec2 vTexCoord;

// uniform float uLevelSize;
uniform sampler2D uSource;
uniform float uRoughnessLevel;
uniform float uMipmapLevel;

// uniform float uSourceSize;
// uniform float uSourceRegionSize;

void main() {
  vec2 uv = vTexCoord;
  float width = 2048.0;
  float maxLevel = 11.0; // this should come from log of size
  float levelSizeInPixels = pow(2.0, 1.0 + uMipmapLevel + uRoughnessLevel);
  float levelSize = width / levelSizeInPixels;
  float roughnessLevelWidth = width / pow(2.0, 1.0 + uRoughnessLevel);
  float vOffset = (width - pow(2.0, maxLevel - uRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - uMipmapLevel);
  // trying to fix oveflow from atlas..
  uv = (uv * levelSize - 0.5) / (levelSize - 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  gl_FragColor = texture2D(uSource, uv);
}
`
