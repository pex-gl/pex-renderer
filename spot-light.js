import Signal from 'signals'

class SpotLight {
  constructor (opts) {
    this.type = 'SpotLight'
    this.changed = new Signal()
    this.target = [0, 0, 0]
    this.color = [1, 1, 1, 1]
    this.intensity = 1
    this.angle = Math.PI / 12
    this.range = 10
    this.castShadows = false

    this.set(opts)
  }

  init (entity) {
    this.entity = entity
  }

  set (opts) {
    Object.assign(this, opts)

    if (opts.color !== undefined || opts.intensity !== undefined) {
      this.color[3] = this.intensity
    }

    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }
}

export default opts => new SpotLight(opts)
