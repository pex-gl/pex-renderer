module.exports = /* glsl */ `
precision highp float;

varying vec2 vTexCoord;

uniform float near;
uniform float far;
uniform float fov;

uniform sampler2D image;
uniform sampler2D emissiveTex;
uniform vec2 imageSize;

uniform float uExposure;
uniform float uBloomThreshold;

float perceivedBrightness(vec3 c) {
  return (c.r + c.g + c.b) / 3.0;
  //return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  vec2 vUV = vec2(gl_FragCoord.x / imageSize.x, gl_FragCoord.y / imageSize.y);
  vec4 color = texture2D(image, vUV);
  color.rgb *= uExposure;
  float brightness = perceivedBrightness(color.rgb);
  if (brightness > uBloomThreshold) {
    gl_FragColor = color;
  } else {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }

  gl_FragColor += texture2D(emissiveTex, vUV);
}
`
