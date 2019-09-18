const Signal = require('signals')

function GridHelper(opts) {
  this.type = 'GridHelper'
  this.entity = null
  this.color = [0.7,0.7,0.7,1]
  this.size = 10
  this.step = 1
  this.enabled = true
  this.changed = new Signal()
  this.dirty = false

  if(opts)this.set(opts)
}

// this function gets called when the component is added
// to an enity
GridHelper.prototype.init = function(entity) {
  this.entity = entity
}

GridHelper.prototype.set = function(opts) {
    Object.assign(this, opts)
    this.dirty = true
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

GridHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}

GridHelper.prototype.draw = function(geomBuilder){
  for (let i = -this.size/2; i <= this.size/2; i += this.step) {
    geomBuilder.addPosition([this.size/2,0,i])
    geomBuilder.addPosition([-this.size/2,0,i])
    geomBuilder.addColor(this.color)
    geomBuilder.addColor(this.color)
  }
  for (let i = -this.size/2; i <= this.size/2; i += this.step) {
    geomBuilder.addPosition([i,0,this.size/2])
    geomBuilder.addPosition([i,0,-this.size/2])
    geomBuilder.addColor(this.color)
    geomBuilder.addColor(this.color)
  }

}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createGridHelper(opts) {
  return new GridHelper(opts)
}