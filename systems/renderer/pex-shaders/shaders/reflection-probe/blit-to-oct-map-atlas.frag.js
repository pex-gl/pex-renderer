export default /* glsl */ `
precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uOctMap;
uniform float uOctMapSize;
uniform float uSourceRegionSize;

void main() {
  vec2 uv = vTexCoord;
  uv *= uSourceRegionSize / uOctMapSize;

  gl_FragColor = texture2D(uOctMap, uv);
}
`;
