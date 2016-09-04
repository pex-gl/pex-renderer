#ifdef GL_ES
precision highp float;
#endif

#pragma glslify: tonemap = require(./local_modules/glsl-tonemap-filmic)
#pragma glslify: toGamma = require(glsl-gamma/out)

uniform sampler2D image;
uniform float uExposure;

varying vec2 vTexCoord;

void main() {
    vec3 color = texture2D(image, vTexCoord).rgb;
    color *= uExposure;
    color = tonemap(color); // filmic has built-in gamma
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
