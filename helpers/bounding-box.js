//no use right now
const Signal = require('signals')

function BoundingBoxHelper(opts) {
  this.type = 'BoundingBoxHelper'
  this.entity = null
  this.color = [1,1,1,1]
  this.changed = new Signal()
  this.dirty = false
  
  this.set(opts)
}

// this function gets called when the component is added
// to an enity
BoundingBoxHelper.prototype.init = function(entity) {
  this.entity = entity
}

BoundingBoxHelper.prototype.set = function(opts) {
  Object.assign(this, opts)
  this.dirty = true

  //SET IS GIVING ERRORS
  //Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

BoundingBoxHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createBoundingBoxHelper(opts) {
  return new BoundingBoxHelper(opts)
}