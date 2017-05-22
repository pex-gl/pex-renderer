#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

#pragma glslify: toGamma = require(glsl-gamma/out)
#pragma glslify: encodeRGBM = require(../local_modules/glsl-rgbm/encode)

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
}

#pragma glslify: export(encode)
