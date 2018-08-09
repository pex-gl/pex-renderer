import Signal from 'signals'

class AmbientLight {
  constructor (opts) {
    this.type = 'AmbientLight'
    this.changed = new Signal()
    this.color = [1, 1, 1, 1]
    this.intensity = 1

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

export default opts => new AmbientLight(opts)
