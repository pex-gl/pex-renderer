const Signal = require('signals')

function SpotLight (opts) {
  this.type = 'SpotLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.angle = Math.PI / 12
  this.direction = [0, -1, 0]
  this.distance = 10
  this.castShadows = false

  this.set(opts)
}

SpotLight.prototype.init = function (entity) {
  this.entity = entity
}

SpotLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new SpotLight(opts)
}
