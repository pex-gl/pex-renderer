var renderToCubemap = require('./local_modules/pex-render-to-cubemap')
var downsampleCubemap = require('./local_modules/pex-downsample-cubemap')
var convolveCubemap = require('./local_modules/pex-convolve-cubemap')
var prefilterCubemap = require('./local_modules/pex-prefilter-cubemap')
var isMobile = require('is-mobile')()
var isBrowser = require('is-browser')
var cubemapToOctmap = require('./local_modules/cubemap-to-octmap')

var useOctohedralMaps = false

// Mipmap levels
//
// 0 - 256
// 1 - 128
// 2 - 64
// 3 - 32
// 4 - 16
// 5 - 8

function ReflectionProbe (cmdQueue, position) {
  this._cmdQueue = cmdQueue

  var ctx = cmdQueue.getContext()
  var gl = ctx.getGL()

  this._reflectionPREM = ctx.createTextureCube(null, 256, 256, { type: ctx.HALF_FLOAT, minFilter: ctx.LINEAR_MIPMAP_LINEAR, magFilter: ctx.LINEAR, flipEnvMap: 1 })
  // FIXME: add mip mapping to TextureCube
  ctx.bindTexture(this._reflectionPREM)
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP)
  this._reflectionMap = ctx.createTextureCube(null, 256, 256, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT, flipEnvMap: 1 })
  this._reflectionMap128 = ctx.createTextureCube(null, 128, 128, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT, flipEnvMap: 1 })
  this._reflectionMap64 = ctx.createTextureCube(null, 64, 64, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT, flipEnvMap: 1 })
  this._reflectionMap32 = ctx.createTextureCube(null, 32, 32, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT, flipEnvMap: 1 })
  this._reflectionMap16 = ctx.createTextureCube(null, 16, 16, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT, flipEnvMap: 1 })
  this._irradianceMap = ctx.createTextureCube(null, 16, 16, { type: ctx.HALF_FLOAT, flipEnvMap: 1 })

  if (useOctohedralMaps) {
    this._reflectionOctMap = ctx.createTexture2D(null, 512, 512, { type: ctx.HALF_FLOAT })
  }
}

ReflectionProbe.prototype.update = function (drawScene) {
  var cmdQueue = this._cmdQueue

  renderToCubemap(cmdQueue, this._reflectionMap, drawScene)
  downsampleCubemap(cmdQueue, this._reflectionMap, this._reflectionMap128)
  downsampleCubemap(cmdQueue, this._reflectionMap128, this._reflectionMap64)
  downsampleCubemap(cmdQueue, this._reflectionMap64, this._reflectionMap32)
  downsampleCubemap(cmdQueue, this._reflectionMap32, this._reflectionMap16)
  convolveCubemap(cmdQueue, this._reflectionMap16, this._irradianceMap)
  prefilterCubemap(cmdQueue, this._reflectionMap, this._reflectionPREM, { highQuality: !isMobile && !isBrowser })
  // if (useOctohedralMaps) {
    // cubemapToOctmap(cmdQueue, this._reflectionMap, this._reflectionOctMap)
  // }
}

ReflectionProbe.prototype.getReflectionMap = function () {
  return this._reflectionPREM
}

ReflectionProbe.prototype.getIrradianceMap = function () {
  return this._irradianceMap
}

module.exports = ReflectionProbe
