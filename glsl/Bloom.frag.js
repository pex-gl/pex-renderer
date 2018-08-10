module.exports = `
#define GLSLIFY 1
#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTexCoord;

uniform float near;
uniform float far;
uniform float fov;

uniform sampler2D image;
uniform vec2 imageSize;

uniform vec2 direction;

uniform float sharpness;

float random(vec2 co)
{
    float a = 12.9898;
    float b = 78.233;
    float c = 43758.5453;
    float dt= dot(co.xy ,vec2(a,b));
    float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

//blur weight based on https://github.com/nvpro-samples/gl_ssao/blob/master/hbao_blur.frag.glsl
vec4 bloom(sampler2D image, vec2 imageResolution, vec2 uv, vec2 direction) {
  vec4 color = vec4(0.0);
  const int numSamples = 9;
  const float blurRadius = float(numSamples) / 2.0;
  const float blurSigma = blurRadius * 0.5;
  const float blurFalloff = 1.0 / (2.0*blurSigma*blurSigma);

  float weightSum = 0.0;
  for (float i = -8.0; i <= 8.0; i += 2.0) {
    float r = i + random(uv);
    vec2 off = direction * r;
    float weight = exp2(-r * r * blurFalloff);
    weightSum += weight;
    color += texture2D(image, uv + (off / imageResolution)) * weight;
  }
  color /= weightSum;
  return color;
}

void main() {
  vec2 vUV = vec2(gl_FragCoord.x / imageSize.x, gl_FragCoord.y / imageSize.y);
  gl_FragColor = bloom(image, imageSize, vUV, direction);
}
`
