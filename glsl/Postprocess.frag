#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: tonemapReinhard = require(../local_modules/glsl-tonemap-reinhard)
#pragma glslify: toGamma = require(glsl-gamma/out)

uniform vec2 uScreenSize;
uniform sampler2D uColorBufferTex;
uniform float uExposure;

void main() {
    vec2 texCoord = gl_FragCoord.xy / uScreenSize.xy;
    vec3 color = texture2D(uColorBufferTex, texCoord).rgb;
    color *= uExposure;
    color = tonemapReinhard(color);
    color = toGamma(color);
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
