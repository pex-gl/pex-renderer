var renderToCubemap = require('../pex-render-to-cubemap')
var hammersley = require('hammersley')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/prefilter.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/prefilter.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var quadMesh = null
var prefilterProgram = null

function prefilterCubemap (cmdQueue, fromCubemap, toCubemap, options) {
  var ctx = cmdQueue.getContext()
  options = options || {}
  var highQuality = (options.highQuality !== undefined) ? options.highQuality : true

  if (fromCubemap.getWidth() !== toCubemap.getWidth() || fromCubemap.getHeight() !== toCubemap.getHeight()) {
    throw new Error('PrefilterCubemap. Source and target cubemap are different size!')
  }

  var numSamples = highQuality ? 1024 : 128
  var hammersleyPointSet = new Float32Array(4 * numSamples)
  for (var i = 0; i < numSamples; i++) {
    var p = hammersley(i, numSamples)
    hammersleyPointSet[i * 4] = p[0]
    hammersleyPointSet[i * 4 + 1] = p[1]
    hammersleyPointSet[i * 4 + 2] = 0
    hammersleyPointSet[i * 4 + 3] = 0
  }
  var hammersleyPointSetMap = ctx.createTexture2D(hammersleyPointSet, 1, numSamples, { type: ctx.FLOAT, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST })

  if (!quadMesh) {
    var quadAttributes = [ { data: quadPositions, location: ctx.ATTRIB_POSITION } ]
    var quadIndices = { data: quadFaces }
    quadMesh = ctx.createMesh(quadAttributes, quadIndices)

    prefilterProgram = ctx.createProgram(VERT, FRAG)
  }
  var numLevels = Math.log(fromCubemap.getWidth()) / Math.log(2)
  var size = toCubemap.getWidth()
  for (var level = 0; level <= numLevels; level++) {
    renderToCubemap(cmdQueue, toCubemap, function () {
      var drawCommand = cmdQueue.createDrawCommand({
        mesh: quadMesh,
        program: prefilterProgram,
        uniforms: {
          uEnvMap: fromCubemap,
          uHammersleyPointSetMap: hammersleyPointSetMap,
          uNumSamples: numSamples,
          uRoughness: Math.min(1.0, level * 0.2)
        }
      })
      cmdQueue.submit(drawCommand)
    }, level)

    size /= 2
  }

  ctx.popState(ctx.MESH_BIT | ctx.PROGRAM_BIT) // ctx.TEXTURE_BIT
}

module.exports = prefilterCubemap
