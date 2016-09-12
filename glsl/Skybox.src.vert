//Based on http://gamedev.stackexchange.com/questions/60313/implementing-a-skybox-with-glsl-version-330
attribute vec2 aPosition;

#pragma glslify: inverse = require('glsl-inverse')

#ifdef GL_ES
#pragma glslify: transpose = require('glsl-transpose')
#endif

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

varying vec3 wcNormal;

void main() {
    mat4 inverseProjection = inverse(uProjectionMatrix);
    mat3 inverseModelview = transpose(mat3(uViewMatrix));
    vec3 unprojected = (inverseProjection * vec4(aPosition, 0.0, 1.0)).xyz;
    wcNormal = inverseModelview * unprojected;

    gl_Position = aPosition;
}
