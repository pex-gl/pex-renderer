module.exports = `
attribute vec2 aPosition;

varying vec2 vTexCoord0;

void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vTexCoord0 = vec2((aPosition + 1.0) / 2.0);
}
`
