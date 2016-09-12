var renderToCubemap = require('../pex-render-to-cubemap')
var hammersley = require('hammersley')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/convolve.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/convolve.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var drawQuadCommand = null
var hammersleyPointSetMap = null

function convolveCubemap (regl, fromCubemap, toCubemap) {
  if (!drawQuadCommand) {
    var numSamples = 512
    var hammersleyPointSet = new Float32Array(4 * numSamples)
    for (var i = 0; i < numSamples; i++) {
      var p = hammersley(i, numSamples)
      hammersleyPointSet[i * 4] = p[0]
      hammersleyPointSet[i * 4 + 1] = p[1]
      hammersleyPointSet[i * 4 + 2] = 0
      hammersleyPointSet[i * 4 + 3] = 0
    }

    hammersleyPointSetMap = regl.texture({
      width: 1,
      height: numSamples,
      data: hammersleyPointSet,
      type: 'float',
      min: 'nearest',
      max: 'nearest'
    })

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
        uHammersleyPointSetMap: hammersleyPointSetMap
      }
    })
  }

  renderToCubemap(regl, toCubemap, function () {
    regl.clear({
      color: [0, 0, 1, 1]
    })
    drawQuadCommand({
      cubemap: fromCubemap
    })
  })
}

module.exports = convolveCubemap
