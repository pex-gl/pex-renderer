#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: inverse = require('glsl-inverse')

uniform samplerCube uEnvMap;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

uniform float uTextureSize;

vec4 sample(vec2 screenPos, mat4 inverseViewMatrix, mat4 inverseProjectionMatrix) {
    vec4 position = vec4(screenPos.x / uTextureSize * 2.0 - 1.0, screenPos.y / uTextureSize * 2.0 - 1.0, 0.0, 1.0);
    vec3 N = (uInverseViewMatrix * inverseProjectionMatrix * position).xyz;
    return textureCube(uEnvMap, N);
}

void main() {
    // TODO: invert matrices in the vertex shader
    mat4 inverseProjectionMatrix = inverse(uProjectionMatrix);
    mat4 inverseViewMatrix = inverse(uViewMatrix);

    vec4 color = vec4(0.0);
    color += sample(gl_FragCoord.xy + vec2(-0.5, -0.5), inverseViewMatrix, inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(-0.5, +0.5), inverseViewMatrix, inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(+0.5, +0.5), inverseViewMatrix, inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(+0.5, -0.5), inverseViewMatrix, inverseProjectionMatrix);
    color *= 0.25;

    gl_FragColor = color;
}
