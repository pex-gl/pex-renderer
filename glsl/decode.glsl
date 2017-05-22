#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

#pragma glslify: toLinear = require(glsl-gamma/in)
#pragma glslify: decodeRGBM = require(../local_modules/glsl-rgbm/decode)

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}

#pragma glslify: export(decode)
