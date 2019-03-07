module.exports = /* glsl */`
precision highp float;

varying vec2 vTexCoord;

uniform float near;
uniform float far;

uniform sampler2D image;
uniform vec2 imageSize;

uniform sampler2D depthMap;
uniform vec2 depthMapSize;

uniform vec2 direction;

uniform float sharpness;
uniform float uDOFDepth;
uniform float uDOFRange;

//fron depth buf normalized z to linear (eye space) z
//http://stackoverflow.com/questions/6652253/getting-the-true-z-value-from-the-depth-buffer
float readDepth(sampler2D depthMap, vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * near * far / (far + near - z_n * (far - near));
  return z_e;
}

//blur weight based on https://github.com/nvpro-samples/gl_ssao/blob/master/hbao_blur.frag.glsl
vec4 bilateralBlur(sampler2D image, vec2 imageResolution, sampler2D depthMap, vec2 depthMapResolution, vec2 uv, vec2 direction) {
  vec4 color = vec4(0.0);
  const int numSamples = 9;
  const float blurRadius = float(numSamples) / 2.0;
  const float blurSigma = blurRadius * 0.5;
  const float blurFalloff = 1.0 / (2.0*blurSigma*blurSigma);

  float centerDepth = readDepth(depthMap, uv);
  float dist = 0.0;
  if (uDOFDepth > 0.0) {
    dist = max(0.0, min(abs(centerDepth - uDOFDepth) / uDOFRange, 1.0));
    direction *= dist;
  }
  float weightSum = 0.0;
  for (float i = -8.0; i <= 8.0; i += 2.0) {
    float r = i;
    vec2 off = direction * r;
    float sampleDepth = readDepth(depthMap, uv + (off / depthMapResolution));
    float diff = (sampleDepth - centerDepth) * sharpness;
    float weight = exp2(-r * r * blurFalloff - diff * diff);
    weightSum += weight;
    color += texture2D(image, uv + (off / imageResolution)) * weight;
  }
  color /= weightSum;
  return color;
}

void main() {
  vec2 vUV = vec2(gl_FragCoord.x / imageSize.x, gl_FragCoord.y / imageSize.y);
  gl_FragColor = bilateralBlur(image, imageSize, depthMap, depthMapSize, vUV, direction);
}
`
