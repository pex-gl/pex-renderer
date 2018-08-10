const toLinear = require('./lib/glsl-gamma/in.glsl.js')
const decodeRGBM = require('./lib/glsl-rgbm/decode.glsl.js')

module.exports = `
#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

${toLinear}
${decodeRGBM}

vec4 decode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toLinear(pixel);
  if (encoding == SRGB) return toLinear(pixel);
  if (encoding == RGBM) return vec4(decodeRGBM(pixel), 1.0);
  return pixel;
}
`
