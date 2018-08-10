var glslifySync = require('glslify-sync')
var hammersley = require('hammersley')
var isMobile = require('is-mobile')()

var VERT = glslifySync(__dirname + '/glsl/PrefilterOctmap.vert')
var FRAG = glslifySync(__dirname + '/glsl/PrefilterOctmap.frag')
var COPY_FRAG = glslifySync(__dirname + '/glsl/Copy.frag')

var fbo = null
var mesh = null
var program = null
var hammersleyPointSetMap = null

function prefilterOctmap(ctx, fromOctmap, toOctmapAtlas) {
  var highQuality = !isMobile
  var numSamples = highQuality ? 1024 : 256
  console.log('highQuality', highQuality)

  if (!fbo) {
    fbo = ctx.createFramebuffer()

    var positions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    var uvs = [[0,0], [1,0], [1,1], [0,1]]
    var indices = [[0, 1, 2], [0, 2, 3]]

    mesh = ctx.createMesh([
      { data: positions, location: ctx.ATTRIB_POSITION },
      { data: uvs, location: ctx.ATTRIB_TEX_COORD_0 }
    ], { data: indices }, ctx.TRIANGLES)

    program = ctx.createProgram(VERT, FRAG)
    copyProgram = ctx.createProgram(VERT, COPY_FRAG)

    var hammersleyPointSet = new Float32Array(4 * numSamples)
    for(var i=0 i<numSamples i++) {
      var p = hammersley(i, numSamples)
      hammersleyPointSet[i*4]   = p[0]
      hammersleyPointSet[i*4+1] = p[1]
      hammersleyPointSet[i*4+2] = 0
      hammersleyPointSet[i*4+3] = 0
    }
    hammersleyPointSetMap = ctx.createTexture2D(hammersleyPointSet, 1, numSamples, { type: ctx.FLOAT, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST })
  }
  var maxSize = 512
  var maxLevel = Math.log(maxSize)/Math.log(2)
  var numLevels = maxLevel + 1
  var outTexSize = maxSize * 2 + numLevels * 2
  ctx.bindTexture(toOctmapAtlas)
  toOctmapAtlas.update(null, outTexSize, outTexSize, { type: ctx.HALF_FLOAT })

  ctx.bindFramebuffer(fbo)
  fbo.setColorAttachment(0, toOctmapAtlas.getTarget(), toOctmapAtlas.getHandle())
  ctx.bindTexture(fromOctmap, 0)
  ctx.bindTexture(hammersleyPointSetMap, 1)
  ctx.bindProgram(program)
  ctx.bindMesh(mesh)
  ctx.setViewport(0, 0, outTexSize, outTexSize)
  ctx.setClearColor(1, 0, 0, 1)
  ctx.clear(ctx.COLOR_BIT)

  var w = fromOctmap.getWidth()
  var h = fromOctmap.getHeight()
  var prevMap = fromOctmap
  var currMap = fromOctmap
  var extraMaps = []
  if (w != maxSize) {
    throw new Error('Source texture is too small, the expected size is 512px')
  }

  console.log('prefilterOctmap', maxSize, maxLevel)

  for(var level = 0; level<=maxLevel; level++) {
    var slot = maxLevel - level //
    var dx = 1
    var dy = 1 + slot * 2 + Math.pow(2, slot)
    var w = Math.pow(2, slot)
    var h = w
    ctx.bindTexture(prevMap, 0)
    var roughness = level * 0.2
    // console.log('prefilterOctmap', 'level', level, 'dx', dx, 'dy', dy, 'w', w, 'x2', dy + w, 'roughness', roughness, prevMap.getWidth())
    if (i > 0) {
      var currMap = ctx.createTexture2D(null, w, h, { type: ctx.HALF_FLOAT })
      ctx.setViewport(0, 0, w, h)
      extraMaps.push(currMap)
      fbo.setColorAttachment(0, currMap.getTarget(), currMap.getHandle())
      ctx.bindProgram(copyProgram)
      copyProgram.setUniform('uOctMap', 0)
      ctx.drawMesh()
      prevMap = currMap
    }
    fbo.setColorAttachment(0, toOctmapAtlas.getTarget(), toOctmapAtlas.getHandle())
    ctx.bindTexture(currMap, 0)
    ctx.bindProgram(program)
    program.setUniform('uOctMap', 0)
    program.setUniform('uHammersleyPointSetMap', 1)
    program.setUniform('uNumSamples', numSamples)
    program.setUniform('uRoughness', roughness)

    // draw border
    ctx.setViewport(dx - 1, dy - 1, w + 2, h + 2)
    ctx.drawMesh()
    // draw contents
    // ctx.setViewport(dx+1, dy+1, Math.max(1, w-2), Math.max(1, h-2))
    // ctx.drawMesh()
  }

  extraMaps.forEach(function(tex) {
    tex.dispose()
  })


  ctx.setViewport(0, 0, toOctmapAtlas.getWidth(), toOctmapAtlas.getHeight())
  // ctx.getGL().writeImage('png', __dirname + '/oct-atlas.png')

  // program.setUniform('uOctmap', 0)
}

module.exports = prefilterOctmap
