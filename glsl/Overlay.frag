#ifdef GL_ES
precision highp float;
#endif

uniform vec2 uScreenSize;
uniform sampler2D uOverlay;

void main() {
    vec2 texCoord = gl_FragCoord.xy / uScreenSize.xy;
    vec3 color = texture2D(uOverlay, texCoord).rgb;
    gl_FragColor.rgb = color;
    gl_FragColor.a = 1.0;
}
