const Signal = require('signals')
const Mat4 = require('pex-math/Mat4')

function Skin (opts) {
  this.type = 'Skin'
  this.entity = null
  this.joints = []
  this.changed = new Signal()
  this.set(opts)
}

Skin.prototype.init = function (entity) {
  this.entity = entity
}

Skin.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Skin.prototype.update = function () {
  this.jointMatrices = this.joints.map((joint, index) => {
    var m = Mat4.create()
    Mat4.mult(m, joint.transform.modelMatrix)
    Mat4.mult(m, this.inverseBindMatrices[index])
    return m
  })
}

module.exports = function createSkin (opts) {
  return new Skin(opts)
}
