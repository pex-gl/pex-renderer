const SHADERS = require('../chunks/index.js')

module.exports = /* glsl */ `
precision highp float;

${SHADERS.octMapUvToDir}
${SHADERS.octMap}
${SHADERS.rgbm}
${SHADERS.gamma}
${SHADERS.encodeDecode}
${SHADERS.math.PI}

varying vec2 vTexCoord;

uniform sampler2D uSource;
uniform int uSourceEncoding;
uniform float uSourceSize;
uniform float uTextureSize;
uniform int uOutputEncoding;

void main() {
  vec3 N = octMapUVToDir(vTexCoord, uTextureSize);
  vec3 normal = N;

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = cross(normal,right);

  vec3 sampledColor = vec3(0.0, 0.0, 0.0);
  float index = 0.0;
  const float dphi = 2.0 * PI / 180.0 * 2.0;
  const float dtheta = 0.5 * PI / 64.0 * 2.0;
  for(float phi = 0.0; phi < 2.0 * PI; phi += dphi) {
    for(float theta = 0.0; theta < 0.5 * PI; theta += dtheta) {
      vec3 temp = cos(phi) * right + sin(phi) * up;
      vec3 sampleVector = cos(theta) * normal + sin(theta) * temp;
      // in theory this should be sample from mipmap level e.g. 2.0, 0.0
      // but sampling from prefiltered roughness gives much smoother results
      vec2 sampleUV = envMapOctahedral(sampleVector, 0.0, 2.0);
      vec4 color = texture2D( uSource, sampleUV);
      sampledColor += decode(color, uSourceEncoding).rgb * cos(theta) * sin(theta);
      index += 1.0;
    }
  }

  sampledColor = PI * sampledColor / index;
  gl_FragColor = encode(vec4(sampledColor, 1.0), uOutputEncoding);
}
`
