export default /* glsl */ `
precision highp float;

varying vec2 vTexCoord;

uniform float uLevelSize;
uniform sampler2D uSource;
uniform float uSourceSize;
uniform float uSourceRegionSize;

void main() {
  vec2 uv = vTexCoord;
  uv *= uSourceRegionSize / uSourceSize;

  gl_FragColor = texture2D(uSource, uv);
}
`;
