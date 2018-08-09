import Signal from 'signals'
import { mat4 } from 'pex-math'

class Skin {
  constructor (opts) {
    this.type = 'Skin'
    this.entity = null
    this.joints = []
    this.changed = new Signal()
    this.set(opts)
  }

  init (entity) {
    this.entity = entity
  }

  set (opts) {
    Object.assign(this, opts)
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }

  update () {
    this.jointMatrices = this.joints.map((joint, index) => {
      const m = mat4.create()
      mat4.mult(m, joint.transform.modelMatrix)
      mat4.mult(m, this.inverseBindMatrices[index])
      return m
    })
  }
}

export default function createSkin (opts) {
  return new Skin(opts)
}
