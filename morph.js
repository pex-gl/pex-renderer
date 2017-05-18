const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')

function Morph (opts) {
  this.type = 'Morph'
  this.entity = null
  this.targets = opts.targets || []
  this.weights = opts.weights || []
  this.changed = new Signal()
  this.set(opts)
}

Morph.prototype.init = function (entity) {
  this.entity = entity
  let geom = this.entity.getComponent('Geometry')
  this.originalPositions = geom.positions.slice(0)
}

Morph.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Morph.prototype.update = function () {
  let geom = this.entity.getComponent('Geometry')
  // this.targets.forEach((target, i) => {
  //   let weight = this.weights[i]
  //   let newGeom = this.originalPositions.map((pos, k) => {
  //     let targetVertex = target[k]
  //     let morphedVertex = (targetVertex - pos) * weight
  //     morphedVertex += pos
  //     return morphedVertex
  //   })
  //   geom.set({
  //     positions: newGeom
  //   })
  // })
  let newGeom = this.originalPositions.map((pos, i) => {
    let newPos = 0
    let originalPos = this.originalPositions[i]
    this.targets.forEach((target, k) => {
      let weight = this.weights[k]
      let targetVertex = target[i]
      let morphedVertex = (targetVertex - originalPos) * weight
      newPos += morphedVertex
    })
    newPos += originalPos
    return newPos
  })
  geom.set({
    positions: newGeom
  })
}

module.exports = function createMorph (opts) {
  return new Morph(opts)
}
