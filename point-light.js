const Signal = require('signals')

function PointLight (opts) {
  this.type = 'PointLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.radius = 10

  this.set(opts)
}

PointLight.prototype.init = function (entity) {
  this.entity = entity
}

PointLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity;
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new PointLight(opts)
}
