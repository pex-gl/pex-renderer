import Signal from 'signals'

// Overlay position and size if relative to screen size if < 1 or in pixels if > 1
class Overlay {
  constructor (opts) {
    this.type = 'Overlay'
    this.entity = null
    this.dirty = false
    this.changed = new Signal()
    this.x = 0
    this.y = 0
    this.width = 1
    this.height = 1
    this.texture = null
    this.set(opts)
  }

  init (entity) {
    this.entity = entity
  }

  set (opts) {
    Object.assign(this, opts)
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }

  update () {}
}

export default function createOverlay (opts) {
  return new Overlay(opts)
}
