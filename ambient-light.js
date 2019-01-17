const Signal = require('signals')

function AmbientLight (opts) {
  this.type = 'AmbientLight'
  this.enabled = true
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1

  this.set(opts)
}

AmbientLight.prototype.init = function (entity) {
  this.entity = entity
}

AmbientLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new AmbientLight(opts)
}
