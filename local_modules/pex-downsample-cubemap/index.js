var renderToCubemap = require('../pex-render-to-cubemap')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/glsl/downsample.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/glsl/downsample.frag', 'utf8')

var quadPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
var quadFaces = [ [0, 1, 2], [0, 2, 3]]

var quadMesh = null
var downsampleProgram = null

function downsampleCubemap (cmdQueue, fromCubemap, toCubemap) {
  var ctx = cmdQueue.getContext()

  if (!quadMesh) {
    var quadAttributes = [ { data: quadPositions, location: ctx.ATTRIB_POSITION } ]
    var quadIndices = { data: quadFaces }
    quadMesh = ctx.createMesh(quadAttributes, quadIndices)

    downsampleProgram = ctx.createProgram(VERT, FRAG)
  }

  renderToCubemap(cmdQueue, toCubemap, function () {
    var drawCommand = cmdQueue.createDrawCommand({
      mesh: quadMesh,
      program: downsampleProgram,
      textures: {
        '0': fromCubemap
      },
      uniforms: {
        uEnvMap: 0,
        uTextureSize: toCubemap.getWidth()
      }
    })
    cmdQueue.submit(drawCommand)
  })
}

module.exports = downsampleCubemap
