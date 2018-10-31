#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapCubemap = require('../local_modules/glsl-envmap-cubemap');

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform samplerCube uEnvMap;
uniform float uFlipEnvMap;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    gl_FragColor.rgb = textureCube(uEnvMap, envMapCubemap(N, uFlipEnvMap)).rgb;
    gl_FragColor.a = 1.0;
}
