#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform sampler2D image;
uniform vec2 imageSize;

uniform vec2 direction;

#pragma glslify: blur = require('glsl-fast-gaussian-blur')

void main() {
    gl_FragColor = blur(image, vTexCoord, imageSize.xy, direction);
}
