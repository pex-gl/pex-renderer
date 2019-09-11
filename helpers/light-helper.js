const Signal = require('signals')

function LightHelper(opts) {
  this.type = 'LightHelper'
  this.entity = null
  this.color = [1,0,0,1]
  this.changed = new Signal()
  this.dirty = false

  if(opts)this.set(opts)
}

// this function gets called when the component is added
// to an enity
LightHelper.prototype.init = function(entity) {
  this.entity = entity
}

LightHelper.prototype.set = function(opts) {
    Object.assign(this, opts)
    this.dirty = true
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

LightHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createLightHelper(opts) {
  return new LightHelper(opts)
}