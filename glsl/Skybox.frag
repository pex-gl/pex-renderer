#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require('../local_modules/glsl-envmap-equirect');

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    gl_FragColor.rgb = texture2D(uEnvMap, envMapEquirect(N)).rgb;
    gl_FragColor.a = 1.0;
}
