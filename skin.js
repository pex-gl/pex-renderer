const Signal = require('signals')
const mat4 = require('pex-math/mat4')

function Skin(opts) {
  this.type = 'Skin'
  this.enabled = true
  this.changed = new Signal()
  this.entity = null
  this.joints = []
  this.jointMatrices = []
  this.inverseBindMatrices = []
  this.set(opts)
}

Skin.prototype.init = function(entity) {
  this.entity = entity
}

Skin.prototype.set = function(opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.joints) {
    this.jointMatrices.length = this.joints.length
    for (let i = 0; i < this.joints.length; i++) {
      this.jointMatrices[i] = this.jointMatrices[i] || mat4.create()
    }
  }
}

Skin.prototype.update = function() {
  if (!this.enabled) return

  for (let i = 0; i < this.joints.length; i++) {
    const joint = this.joints[i]
    const m = this.jointMatrices[i]
    mat4.identity(m)
    mat4.mult(m, joint.transform.modelMatrix)
    mat4.mult(m, this.inverseBindMatrices[i])
  }
}

module.exports = function createSkin(opts) {
  return new Skin(opts)
}
