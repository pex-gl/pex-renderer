#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord0;

uniform sampler2D uOctMap;

void main() {
    gl_FragColor = texture2D(uOctMap, vTexCoord0);
}

