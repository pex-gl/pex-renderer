#pragma glslify: inverse = require('glsl-inverse')

#ifdef GL_ES
#pragma glslify: transpose = require('glsl-transpose')
#endif

attribute vec4 aPosition;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uInverseViewMatrix;

varying vec3 wcNormal;
varying vec2 scPosition;

void main() {
    mat4 inverseProjection = inverse(uProjectionMatrix);
    mat3 inverseModelview = transpose(mat3(uViewMatrix));
    vec3 unprojected = (inverseProjection * aPosition).xyz;
    wcNormal = inverseModelview * unprojected;
    gl_Position = aPosition;
    scPosition = aPosition.xy;
}
