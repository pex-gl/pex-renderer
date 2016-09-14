var renderToCubemap = require('../pex-render-to-cubemap')
var hammersley = require('hammersley')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/prefilter.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/prefilter.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var drawQuadCommand = null

function prefilterCubemap (regl, fromCubemap, toCubemap, options) {
  options = options || {}
  var highQuality = (options.highQuality !== undefined) ? options.highQuality : true

  if (fromCubemap.width !== toCubemap.width) {
    throw new Error('PrefilterCubemap. Source and target cubemap are different size!')
  }

  if (!drawQuadCommand) {
    var numSamples = highQuality ? 1024 : 128
    var hammersleyPointSet = new Float32Array(4 * numSamples)
    for (var i = 0; i < numSamples; i++) {
      var p = hammersley(i, numSamples)
      hammersleyPointSet[i * 4] = p[0]
      hammersleyPointSet[i * 4 + 1] = p[1]
      hammersleyPointSet[i * 4 + 2] = 0
      hammersleyPointSet[i * 4 + 3] = 0
    }
    var hammersleyPointSetMap = regl.texture({
      data: hammersleyPointSet,
      width: 1,
      height: numSamples,
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
        uHammersleyPointSetMap: hammersleyPointSetMap,
        uNumSamples: numSamples,
        uRoughness: regl.prop('roughness')        // uTextureSize: regl.prop('cubemapSize')
      }
    })
  }
  var numLevels = Math.log(fromCubemap.width) / Math.log(2)

  for (var level = 0; level <= numLevels; level++) {
    renderToCubemap(regl, toCubemap, function () {
      regl.clear({
        color: [0, 0, 0, 1]
      })
      drawQuadCommand({
        cubemap: fromCubemap,
        // TODO: this should be called targetCubemapSize, not cubemapSize
        cubemapSize: toCubemap.width,
        roughness: Math.min(1.0, level * 0.2)
      })
    })
  }
}

module.exports = prefilterCubemap
