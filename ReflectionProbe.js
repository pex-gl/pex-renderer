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

function ReflectionProbe (regl, position) {
  this._regl = regl

  var type = isBrowser ? 'half float' : 'float'
  try {
    this._reflectionPREM = regl.cube({ width: 256, height: 256, min: 'nearest', max: 'nearest', type: type })
  // // FIXME: add mip mapping to TextureCube
  // ctx.bindTexture(this._reflectionPREM)
  // gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

    this._reflectionMap = regl.cube({ width: 256, height: 256, min: 'nearest', max: 'nearest', type: type })
    this._reflectionMap128 = regl.cube({ width: 128, height: 128, min: 'nearest', max: 'nearest', type: type })
    this._reflectionMap64 = regl.cube({ width: 64, height: 64, min: 'nearest', max: 'nearest', type: type })
    this._reflectionMap32 = regl.cube({ width: 32, height: 32, min: 'nearest', max: 'nearest', type: type })
    this._reflectionMap16 = regl.cube({ width: 16, height: 16, min: 'nearest', max: 'nearest', type: type })
    this._irradianceMap = regl.cube({ width: 16, height: 16, min: 'linear', max: 'linear', type: type })
  } catch (e) {
    console.log('ReflectionProbe exited with error')
    console.log(e)
  }

  // if (useOctohedralMaps) {
    // this._reflectionOctMap = ctx.createTexture2D(null, 512, 512, { type: ctx.HALF_FLOAT })
  // }
}

ReflectionProbe.prototype.update = function (drawScene) {
  var regl = this._regl

  renderToCubemap(regl, this._reflectionMap, drawScene)
  downsampleCubemap(regl, this._reflectionMap, this._reflectionMap128)
  downsampleCubemap(regl, this._reflectionMap128, this._reflectionMap64)
  downsampleCubemap(regl, this._reflectionMap64, this._reflectionMap32)
  downsampleCubemap(regl, this._reflectionMap32, this._reflectionMap16)
  convolveCubemap(regl, this._reflectionMap16, this._irradianceMap)
  // if (!isBrowser) {
    // prefilterCubemap(cmdQueue, this._reflectionMap, this._reflectionPREM, { highQuality: !isMobile && !isBrowser })
  // }
  // if (useOctohedralMaps) {
    // cubemapToOctmap(cmdQueue, this._reflectionMap, this._reflectionOctMap)
  // }
}

ReflectionProbe.prototype.getReflectionMap = function () {
  // FIXME: re-enable blurry reflection in the browser
  return this._reflectionMap
  // return isBrowser ? this._reflectionMap : this._reflectionMapPRM
}

ReflectionProbe.prototype.getIrradianceMap = function () {
  return this._irradianceMap
}

module.exports = ReflectionProbe
