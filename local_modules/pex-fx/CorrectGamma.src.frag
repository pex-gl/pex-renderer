#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: toGamma  = require('glsl-gamma/out')

varying vec2 vTexCoord;
uniform sampler2D tex0;

void main() {
    vec4 color = texture2D(tex0, vTexCoord).rgba;
    //premultiplied linear
    //http://ssp.impulsetrain.com/gamma-premult.html
    gl_FragColor.rgb = toGamma(color.rgb/color.a)*color.a;
    gl_FragColor.a = color.a;
}
