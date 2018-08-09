import Signal from 'signals'

let MaterialID = 0

class Material {
  constructor (opts) {
    this.type = 'Material'
    this.id = `Material_${MaterialID++}`
    this.changed = new Signal()

    this._uniforms = {}

    const ctx = opts.ctx

    this.baseColor = [0.95, 0.95, 0.95, 1]
    this.baseColorMap = null
    this.emissiveColor = [0, 0, 0, 1]
    this.emissiveColorMap = null
    this.metallic = 0.01
    this.matallicMap = null
    this.occlusionMap = null
    // required for GLTF support
    // R = ?, G = roughness, B = metallic
    this.metallicRoughnessMap = null
    this.roughness = 0.5
    this.roughnessMap = null
    this.displacement = 0
    this.depthTest = true
    this.depthWrite = true
    this.depthFunc = opts.ctx.DepthFunc.LessEqual
    this.alphaTest = null
    this.blend = false
    this.blendSrcRGBFactor = ctx.BlendFactor.One
    this.blendSrcAlphaFactor = ctx.BlendFactor.One
    this.blendDstRGBFactor = ctx.BlendFactor.One
    this.blendDstAlphaFactor = ctx.BlendFactor.One
    this.castShadows = false
    this.receiveShadows = false
    this.cullFace = true
    this.set(opts)
  }

  init (entity) {
    this.entity = entity
  }

  set (opts) {
    Object.assign(this, opts)
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }
}

export default opts => new Material(opts)
