const Signal = require('signals')
const AreaLightsData = require('./area-light-data')

function AreaLight (opts) {
  const ctx = opts.ctx

  this.type = 'AreaLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.castShadows = false

  this.set(opts)

  // TODO: area light textures
  if (!AreaLight.areaLightTexturesRefs) {
    AreaLight.ltc_mat_texture = ctx.texture2D({
      data: AreaLightsData.mat,
      width: 64,
      height: 64,
      pixelFormat: ctx.PixelFormat.RGBA32F,
      encoding: ctx.Encoding.Linear,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear
    })
    AreaLight.ltc_mag_texture = ctx.texture2D({
      data: AreaLightsData.mag,
      width: 64,
      height: 64,
      pixelFormat: ctx.PixelFormat.R32F,
      encoding: ctx.Encoding.Linear,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.Linear
    })
  }
  AreaLight.areaLightTexturesRefs = (AreaLight.areaLightTexturesRefs || 0) + 1
  this.ltc_mat_texture = AreaLight.ltc_mat_texture
  this.ltc_mag_texture = AreaLight.ltc_mag_texture
}

AreaLight.prototype.init = function (entity) {
  this.entity = entity
}

AreaLight.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }
}

AreaLight.prototype.dispose = function () {
  if (--AreaLight.areaLightTexturesRefs === 0) {
    this.ctx.dispose(AreaLight.ltc_mat_texture)
    AreaLight.ltc_mat_texture = null
    this.ctx.dispose(AreaLight.ltc_mag_texture)
    AreaLight.ltc_mag_texture = null
  }
}

module.exports = function (opts) {
  return new AreaLight(opts)
}
