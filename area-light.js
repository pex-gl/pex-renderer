import Signal from 'signals'
import AreaLightsData from './local_modules/area-light-data'

class AreaLight {
  constructor(opts) {
    const ctx = opts.ctx

    this.type = 'AreaLight'
    this.changed = new Signal()
    this.color = [1, 1, 1, 1]
    this.intensity = 1
    this.castShadows = false

    this.set(opts)

    // TODO: area light textures
    if (!AreaLight.areaLightTextures) {
      AreaLight.ltc_mat_texture = ctx.texture2D({
        data: AreaLightsData.mat,
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.RGBA32F,
        encoding: ctx.Encoding.Linear
      })
      AreaLight.ltc_mag_texture = ctx.texture2D({
        data: AreaLightsData.mag,
        width: 64,
        height: 64,
        pixelFormat: ctx.PixelFormat.R32F,
        encoding: ctx.Encoding.Linear
      })
      AreaLight.areaLightTextures = true
    }
    this.ltc_mat_texture = AreaLight.ltc_mat_texture
    this.ltc_mag_texture = AreaLight.ltc_mag_texture
  }

  init(entity) {
    this.entity = entity
  }

  set(opts) {
    Object.assign(this, opts)
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))

    if (opts.color !== undefined || opts.intensity !== undefined) {
      this.color[3] = this.intensity
    }
  }
}

export default opts => new AreaLight(opts)
