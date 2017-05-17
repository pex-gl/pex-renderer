#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: envMapEquirect = require('../local_modules/glsl-envmap-equirect');
#pragma glslify: toGamma = require(glsl-gamma/out)
#pragma glslify: toLinear = require(glsl-gamma/in)
#pragma glslify: encodeRGBM = require(../local_modules/glsl-rgbm/encode)
#pragma glslify: decodeRGBM = require(../local_modules/glsl-rgbm/decode)

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
// uniform int uEnvMapEncoding;
// uniform bool uRGBM;
// uniform bool uCorrectOutputGamma;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    // if (uCorrectOutputGamma) {
      vec4 color = texture2D(uEnvMap, envMapEquirect(N));
    // }

    // if (uOutputRGBM) {
      gl_FragColor = color;
    // } else {
      // vec3 color = decodeRGBM(rgbmColor);
      // color = color / (1.0 + color);
      // color = toGamma(color);
      // gl_FragColor = vec4(color, 1.0);
    // }
}
