import SHADERS from "../chunks/index.js";

export default /* glsl */ `
#ifdef USE_DRAW_BUFFERS
  #extension GL_EXT_draw_buffers : enable
#endif
#ifdef GL_ES
precision highp float;
#endif

#ifdef USE_DRAW_BUFFERS
${SHADERS.gamma}
${SHADERS.rgbm}
${SHADERS.encodeDecode}
uniform int uOutputEncoding;
#endif

varying vec4 vColor;

void main () {
#ifdef USE_DRAW_BUFFERS
  gl_FragData[0] = encode(vec4(vColor.rgb * 3.0, 1.0), uOutputEncoding);
  gl_FragData[1] = vec4(0.0);
#else
  gl_FragData[0] = vColor;
#endif
}
`;
