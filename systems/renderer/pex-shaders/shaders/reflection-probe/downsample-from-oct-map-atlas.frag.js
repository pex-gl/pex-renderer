import SHADERS from "../chunks/index.js";

export default /* glsl */ `
precision highp float;

varying vec2 vTexCoord0;

// uniform float uLevelSize;
uniform sampler2D uOctMapAtlas;
uniform float uOctMapAtlasSize;
uniform float uRoughnessLevel;
uniform float uMipmapLevel;

${SHADERS.octMapUvToDir}
${SHADERS.octMap}

void main() {
  vec2 uv = vTexCoord0;
  float width = uOctMapAtlasSize;
  float maxLevel = log2(width); // this should come from log of size

  float levelSize = width / pow(2.0, 1.0 + uMipmapLevel + uRoughnessLevel);
  float roughnessLevelWidth = width / pow(2.0, 1.0 + uRoughnessLevel);

  float vOffset = (width - pow(2.0, maxLevel - uRoughnessLevel));
  float hOffset = 2.0 * roughnessLevelWidth - pow(2.0, log2(2.0 * roughnessLevelWidth) - uMipmapLevel);
  // trying to fix oveflow from atlas..
  uv = (uv * levelSize - 0.5) / (levelSize - 1.0);
  uv *= levelSize;
  uv = (uv + vec2(hOffset, vOffset)) / width;
  vec4 color = vec4(0.0);
  color += texture2D(uOctMapAtlas, uv);
  color += texture2D(uOctMapAtlas, uv + vec2(-1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 1.0, 0.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0,-1.0)/levelSize);
  color += texture2D(uOctMapAtlas, uv + vec2( 0.0, 1.0)/levelSize);
  color /= 5.0;
  gl_FragColor = color;
}
`;
