var renderToCubemap = require('../pex-render-to-cubemap')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/downsample.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/downsample.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var drawQuadCommand = null

function downsampleCubemap (regl, fromCubemap, toCubemap) {
  if (!drawQuadCommand) {
    drawQuadCommand = regl({
      attributes: {
        aPosition: quadPositions
      },
      elements: quadFaces,
      vert: VERT,
      frag: FRAG,
      uniforms: {
        uProjectionMatrix: regl.context('projectionMatrix'),
        uViewMatrix: regl.context('viewMatrix'),
        uEnvMap: regl.prop('cubemap'),
        uTextureSize: regl.prop('cubemapSize')
      }
    })
  }

  renderToCubemap(regl, toCubemap, function () {
    drawQuadCommand({
      cubemap: fromCubemap,
      // TODO: this should be called targetCubemapSize, not cubemapSize
      cubemapSize: toCubemap.width
    })
  })
}

module.exports = downsampleCubemap
