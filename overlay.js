const Signal = require('signals')

// Overlay position and size if relative to screen size if < 1 or in pixels if > 1
function Overlay (opts) {
  this.type = 'Overlay'
  this.entity = null
  this.dirty = false
  this.changed = new Signal()
  this.x = 0
  this.y = 0
  this.width = 1
  this.height = 1
  this.texture = null
  this.alpha = 1
  this.set(opts)
}

Overlay.prototype.init = function (entity) {
  this.entity = entity
}

Overlay.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Overlay.prototype.update = function () {
}

module.exports = function createOverlay (opts) {
  return new Overlay(opts)
}
