module.exports = /* glsl */ `
#extension GL_EXT_shader_texture_lod : enable

precision highp float;

varying vec2 vTexCoord0;

uniform sampler2D image;
uniform vec2 imageSize;

vec3 sampleBloom (sampler2D texture, vec2 uv) {
  vec3 color = vec3(0.0);
  vec2 s = 1.0 / imageSize;
  color += texture2D(texture, uv + vec2(-1.0, -1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 0.0, -1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 1.0, -1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 0.0, -1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 0.0,  0.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 0.0,  1.0) * s).rgb;
  color += texture2D(texture, uv + vec2(-1.0,  1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 0.0,  1.0) * s).rgb;
  color += texture2D(texture, uv + vec2( 1.0,  1.0) * s).rgb;
  color /= 9.0;
  return color;
}

void main () {
  gl_FragColor.rgb = sampleBloom(image, vTexCoord0);
  gl_FragColor.a = 1.0;
}
`
