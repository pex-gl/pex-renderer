const Signal = require('signals')
const mat4 = require('pex-math/mat4')

function Skin (opts) {
  this.type = 'Skin'
  this.entity = null
  this.joints = []
  this.inverseBindMatrices = []
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
    var m = mat4.create()
    mat4.mult(m, joint.transform.modelMatrix)
    mat4.mult(m, this.inverseBindMatrices[index])
    return m
  })
}

module.exports = function createSkin (opts) {
  return new Skin(opts)
}
