const Signal = require('signals')
const Mat4 = require('pex-math/Mat4')

function AreaLight (opts) {
  const ctx = opts.ctx

  this.type = 'AreaLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.radius = 10

  this.set(opts)
}

AreaLight.prototype.init = function (entity) {
  this.entity = entity
}

AreaLight.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity;
  }
}

module.exports = function (opts) {
  return new AreaLight(opts)
}
