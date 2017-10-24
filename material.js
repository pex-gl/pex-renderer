const Signal = require('signals')

let MaterialID = 0

function Material (opts) {
  this.type = 'Material'
  this.id = 'Material_' + MaterialID++
  this.changed = new Signal()

  this._uniforms = {}

  const ctx = opts.ctx

  this.baseColor = [0.95, 0.95, 0.95, 1]
  this.baseColorMap = null
  this.emissiveColor = [0, 0, 0, 1]
  this.emissiveColorMap = null
  this.metallic = 0.01
  this.matallicMap = null
  this.roughness = 0.5
  this.roughnessMap = null
  this.displacement = 0
  this.depthTest = true
  this.depthWrite = true
  this.depthFunc = opts.ctx.DepthFunc.LessEqual
  this.blendEnabled = false
  this.blendSrcRGBFactor = ctx.BlendFactor.ONE
  this.blendSrcAlphaFactor = ctx.BlendFactor.ONE
  this.blendDstRGBFactor = ctx.BlendFactor.ONE
  this.blendDstAlphaFactor = ctx.BlendFactor.ONE
  this.castShadows = false
  this.receiveShadows = false
  this.cullFaceEnabled = true

  this.set(opts)
}

Material.prototype.init = function (entity) {
  this.entity = entity
}

Material.prototype.set = function (opts) {
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new Material(opts)
}
