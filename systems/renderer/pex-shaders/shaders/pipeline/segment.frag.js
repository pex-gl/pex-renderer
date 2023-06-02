export default /* glsl */ `
#ifdef USE_DRAW_BUFFERS
  #extension GL_EXT_draw_buffers : enable
#endif

precision highp float;

uniform vec4 uBaseColor;

varying vec4 vColor;

#define HOOK_FRAG_DECLARATIONS_END

void main() {
  gl_FragData[0] = uBaseColor * vColor;

  #ifdef USE_DRAW_BUFFERS
    gl_FragData[1] = vec4(0.0);
    gl_FragData[2] = vec4(0.0);
  #endif

  #define HOOK_FRAG_END
}
`;
