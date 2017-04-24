#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require('../local_modules/glsl-envmap-equirect');
#pragma glslify: toGamma = require(glsl-gamma/out)
#pragma glslify: toLinear = require(glsl-gamma/in)
#pragma glslify: encodeRGBM = require(../local_modules/glsl-rgbm/encode)

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    vec4 rgbmColor = texture2D(uEnvMap, envMapEquirect(N));
    gl_FragColor = rgbmColor;
}
