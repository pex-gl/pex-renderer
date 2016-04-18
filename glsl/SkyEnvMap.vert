attribute vec4 aPosition;
attribute vec2 aTexCoord0;

varying vec2 vTexCoord0;

void main() {
    gl_Position = aPosition;
    vTexCoord0 = aTexCoord0;
}
