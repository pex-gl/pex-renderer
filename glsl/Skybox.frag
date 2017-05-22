#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require('../local_modules/glsl-envmap-equirect');
#pragma glslify: encode = require(./encode)
#pragma glslify: decode = require(./decode)

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
uniform int uEnvMapEncoding;
uniform int uOutputEncoding;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    vec4 color = decode(texture2D(uEnvMap, envMapEquirect(N)), uEnvMapEncoding);

    gl_FragColor = encode(color, uOutputEncoding);
}
