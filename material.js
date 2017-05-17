const Signal = require('signals')

let MaterialID = 0

function Material (opts) {
  this.type = 'Material'
  this.id = 'Material_' + MaterialID++
  this.changed = new Signal()

  this._uniforms = {}

  this.baseColor = [0.95, 0.95, 0.95, 1]
  this.emissiveColor = [0, 0, 0, 1]
  this.metallic = 0.01
  this.roughness = 0.5
  this.depthTest = true
  this.depthWrite = true
  this.depthFunc = opts.ctx.DepthFunc.Less

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
