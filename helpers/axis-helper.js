const Signal = require('signals')

function AxisHelper(opts) {
  this.type = 'AxisHelper'
  this.entity = null
  this.color = [1,0,0,1]
  this.scale = 1
  this.changed = new Signal()
  this.dirty = false

  if(opts)this.set(opts)
}

// this function gets called when the component is added
// to an enity
AxisHelper.prototype.init = function(entity) {
  this.entity = entity
}

AxisHelper.prototype.set = function(opts) {
    Object.assign(this, opts)
    this.dirty = true
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

AxisHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createAxisHelper(opts) {
  return new AxisHelper(opts)
}