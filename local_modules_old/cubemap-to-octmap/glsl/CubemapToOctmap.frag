
#ifdef GL_ES
precision highp float;
#define GLSLIFY 1
#endif


varying vec2 vTexCoord0;

#pragma glslify: envMapCube      = require(../../glsl-envmap-cubemap)

//if < 0 return -1, otherwise 1
vec2 signed(vec2 v) {
    return step(0.0, v) * 2.0 - 1.0;
}

vec3 octUvToDir(vec2 uv) {
    uv = uv * 2.0 - 1.0;

    vec2 auv = abs(uv);
    float len = dot(auv, vec2(1.0));

    if (len > 1.0) {
        //y < 0 case
        uv = (auv.yx - 1.0) * -1.0 * signed(uv);
    }

    return normalize(vec3(uv.x, 1.0 - len, uv.y));
}

uniform samplerCube uCubemap;
uniform float uCubemapFlipEnvMap;

void main() {
    vec3 dir = octUvToDir(vTexCoord0);
    gl_FragColor = textureCube(uCubemap, envMapCube(dir, uCubemapFlipEnvMap));
}
