var renderToCubemap = require('../pex-render-to-cubemap')
var hammersley = require('hammersley')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/convolve.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/convolve.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var quadMesh = null
var convolveProgram = null
var hammersleyPointSetMap = null

function convolveCubemap (cmdQueue, fromCubemap, toCubemap) {
  var ctx = cmdQueue.getContext()

  if (!quadMesh) {
    var quadAttributes = [ { data: quadPositions, location: ctx.ATTRIB_POSITION } ]
    var quadIndices = { data: quadFaces }
    quadMesh = ctx.createMesh(quadAttributes, quadIndices)

    convolveProgram = ctx.createProgram(VERT, FRAG)

    var numSamples = 512
    var hammersleyPointSet = new Float32Array(4 * numSamples)
    for (var i = 0; i < numSamples; i++) {
      var p = hammersley(i, numSamples)
      hammersleyPointSet[i * 4] = p[0]
      hammersleyPointSet[i * 4 + 1] = p[1]
      hammersleyPointSet[i * 4 + 2] = 0
      hammersleyPointSet[i * 4 + 3] = 0
    }

    hammersleyPointSetMap = ctx.createTexture2D(hammersleyPointSet, 1, numSamples, { type: ctx.FLOAT, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST })
  }
  renderToCubemap(cmdQueue, toCubemap, function () {
    var drawCommand = cmdQueue.createDrawCommand({
      mesh: quadMesh,
      program: convolveProgram,
      uniforms: {
        uEnvMap: fromCubemap,
        uHammersleyPointSetMap: hammersleyPointSetMap
      }
    })
    cmdQueue.submit(drawCommand)
  })
}

module.exports = convolveCubemap
