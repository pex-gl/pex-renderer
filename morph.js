const Signal = require('signals')

function Morph (opts) {
  this.type = 'Morph'
  this.entity = null
  this.dirty = false
  this.targets = opts.targets || []
  this.weights = opts.weights || []
  this.changed = new Signal()
  this.set(opts)
}

Morph.prototype.init = function (entity) {
  this.entity = entity
  let geom = this.entity.getComponent('Geometry')
  console.log('geom.positions', geom.positions, this)
  this.originalPositions = (geom.positions.buffer && geom.positions.buffer.data) ? geom.positions.buffer.data.slice(0) : geom.positions.slice(0)
}

Morph.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
  this.dirty = true
}

Morph.prototype.update = function () {
  if (!this.dirty) return
  this.dirty = false

  let geom = this.entity.getComponent('Geometry')
  let newGeom = this.originalPositions.map((pos, i) => {
    let newPos = 0
    if (pos.length) {
      newPos = [0, 0, 0]
    }
    let originalPos = this.originalPositions[i]
    this.targets.forEach((target, k) => {
      let weight = this.weights[k]
      let targetVertex = target[i]
      if (pos.length) {
        newPos[0] += targetVertex[0] * weight
        newPos[1] += targetVertex[1] * weight
        newPos[2] += targetVertex[2] * weight
      } else {
        newPos += targetVertex * weight
      }
    })
    if (pos.length) {
      newPos[0] += originalPos[0]
      newPos[1] += originalPos[1]
      newPos[2] += originalPos[2]
    } else {
      newPos += originalPos
    }
    return newPos
  })
  geom.set({
    positions: newGeom
  })
}

module.exports = function createMorph (opts) {
  return new Morph(opts)
}
