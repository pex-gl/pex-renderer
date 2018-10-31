attribute vec4 aPosition;
attribute vec2 aTexCoord0; 

varying vec2 vTexCoord0;

void main() {
    vTexCoord0 = aTexCoord0;
    gl_Position = aPosition;
}
