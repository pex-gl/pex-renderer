export default /* glsl */ `
precision highp float;

varying vec2 vTexCoord0;
uniform sampler2D uTexture;
void main() {
    gl_FragColor = texture2D(uTexture, vTexCoord0);
}
`;
