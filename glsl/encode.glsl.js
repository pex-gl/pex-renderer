const toGamma = require('./lib/glsl-gamma/out.glsl.js')
const encodeRGBM = require('./lib/glsl-rgbm/encode.glsl.js')

module.exports = `
#define LINEAR 1
#define GAMMA 2
#define SRGB 3
#define RGBM 4

${toGamma}
${encodeRGBM}

vec4 encode(vec4 pixel, int encoding) {
  if (encoding == LINEAR) return pixel;
  if (encoding == GAMMA) return toGamma(pixel);
  if (encoding == SRGB) return toGamma(pixel);
  if (encoding == RGBM) return encodeRGBM(pixel.rgb);
  return pixel;
}
`
