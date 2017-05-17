const Signal = require('signals')

function Material (opts) {
  this.type = 'Material'
  this.changed = new Signal()

  this._uniforms = {}

  this.baseColor = [0.95, 0.95, 0.95, 1]
  this.emissiveColor = [0, 0, 0, 1]
  this.metallic = 0.01
  this.roughness = 0.5
  this.displacement = 0

  this.set(opts)
}

Material.prototype.init = function (entity) {
  this.entity = entity
}

Material.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new Material(opts)
}
