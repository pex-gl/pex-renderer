#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: tonemap = require(./local_modules/glsl-tonemap-filmic)
#pragma glslify: toGamma = require(glsl-gamma/out)

uniform sampler2D tex0;
uniform float uExposure;

varying vec2 vTexCoord;

void main() {
    vec3 color = texture2D(tex0, vTexCoord).rgb;
    color *= uExposure;
    color = tonemap(color);
    color = toGamma(color);
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
