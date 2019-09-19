const Signal = require('signals')

function BoundingBoxHelper(opts) {
  this.type = 'BoundingBoxHelper'
  this.entity = null
  this.enabled = true
  this.color = [1, 0, 0, 1]
  this.changed = new Signal()
  this.dirty = false

  if (opts) this.set(opts)
}

// this function gets called when the component is added
// to an enity
BoundingBoxHelper.prototype.init = function(entity) {
  this.entity = entity
}

BoundingBoxHelper.prototype.set = function(opts) {
  Object.assign(this, opts)
  this.dirty = true
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

BoundingBoxHelper.prototype.update = function() {
  if (!this.dirty) return
  this.dirty = false
}
BoundingBoxHelper.prototype.getBBoxPositionsList = function(bbox) {
  return [
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[0][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[1][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[1][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[0][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[0][0], bbox[1][1], bbox[1][2]],
    [bbox[0][0], bbox[0][1], bbox[1][2]],
    [bbox[1][0], bbox[0][1], bbox[1][2]]
  ]
}

BoundingBoxHelper.prototype.getBBoxGeometry = function(
  geomBuilder,
  bbox,
  color
) {
  let positions = this.getBBoxPositionsList(bbox)
  positions.forEach((pos) => {
    geomBuilder.addPosition(pos)
    geomBuilder.addColor(color)
  })
}

BoundingBoxHelper.prototype.draw = function(geomBuilder) {
  this.getBBoxGeometry(
    geomBuilder,
    this.entity.transform.worldBounds,
    this.color
  )
}

// by pex-renderer convention we export factory function
// instead of the class type
module.exports = function createBoundingBoxHelper(opts) {
  return new BoundingBoxHelper(opts)
}
