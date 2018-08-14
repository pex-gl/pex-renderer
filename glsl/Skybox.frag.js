const envMapEquirect = require('./lib/glsl-envmap-equirect/index.glsl.js');
const encode = require('./encode.glsl.js')
const decode = require('./decode.glsl.js')

module.exports = `
#ifdef GL_ES
precision highp float;
#ifdef USE_DRAW_BUFFERS
#extension GL_EXT_draw_buffers : require
#endif
#endif

${envMapEquirect}
${encode}
${decode}

//assuming texture in Linear Space
//most likely HDR or Texture2D with sRGB Ext
uniform sampler2D uEnvMap;
uniform int uEnvMapEncoding;
uniform int uOutputEncoding;

varying vec3 wcNormal;

void main() {
    vec3 N = normalize(wcNormal);

    vec4 color = decode(texture2D(uEnvMap, envMapEquirect(N)), uEnvMapEncoding);
    gl_FragData[0] = encode(color, uOutputEncoding);
#ifdef USE_DRAW_BUFFERS
    gl_FragData[1] = vec4(0.0);
#endif
}
`
