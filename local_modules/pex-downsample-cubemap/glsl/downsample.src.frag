#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: inverse = require('glsl-inverse')

uniform samplerCube uEnvMap;

uniform mat4 uProjectionMatrix;
uniform mat4 uInverseViewMatrix;
uniform mat4 uViewMatrix;

uniform float uTextureSize;

vec4 sample(vec2 screenPos, mat4 inverseProjectionMatrix) {
    vec4 position = vec4(screenPos.x / uTextureSize * 2.0 - 1.0, screenPos.y / uTextureSize * 2.0 - 1.0, 0.0, 1.0);
    vec3 N = (uInverseViewMatrix * inverseProjectionMatrix * position).xyz;
    return textureCube(uEnvMap, N);
}

void main() {
    mat4 inverseProjectionMatrix = inverse(uProjectionMatrix);

    vec4 color = vec4(0.0);
    color += sample(gl_FragCoord.xy + vec2(-0.5, -0.5), inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(-0.5, +0.5), inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(+0.5, +0.5), inverseProjectionMatrix);
    color += sample(gl_FragCoord.xy + vec2(+0.5, -0.5), inverseProjectionMatrix);
    color *= 0.25;

    gl_FragColor = color;
}
