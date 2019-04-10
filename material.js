const Signal = require('signals')

let MaterialID = 0

// TODO: add to pex-math
function mat3Multiply(a, b) {
  let a00 = a[0], a01 = a[1], a02 = a[2];
  let a10 = a[3], a11 = a[4], a12 = a[5];
  let a20 = a[6], a21 = a[7], a22 = a[8];

  let b00 = b[0], b01 = b[1], b02 = b[2];
  let b10 = b[3], b11 = b[4], b12 = b[5];
  let b20 = b[6], b21 = b[7], b22 = b[8];

  a[0] = b00 * a00 + b01 * a10 + b02 * a20;
  a[1] = b00 * a01 + b01 * a11 + b02 * a21;
  a[2] = b00 * a02 + b01 * a12 + b02 * a22;
  a[3] = b10 * a00 + b11 * a10 + b12 * a20;
  a[4] = b10 * a01 + b11 * a11 + b12 * a21;
  a[5] = b10 * a02 + b11 * a12 + b12 * a22;
  a[6] = b20 * a00 + b21 * a10 + b22 * a20;
  a[7] = b20 * a01 + b21 * a11 + b22 * a21;
  a[8] = b20 * a02 + b21 * a12 + b22 * a22;

  return a;
}

function mat3FromTranslationRotationScale(translation, rotation, scale) {
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)

  return mat3Multiply(
    mat3Multiply(
      [
        1, 0, 0,
        0, 1, 0,
        translation[0], translation[1], 1
      ],
      [
        c, s, 0,
        -s, c, 0,
        0, 0, 1
      ]
    ),
    [
      scale[0], 0, 0,
      0, scale[1], 0,
      0, 0, 1
    ]
  );
}

const MATERIAL_MAPS = [
  'baseColorMap',
  'emissiveColorMap',
  'matallicMap',
  'roughnessMap',
  'metallicRoughnessMap',
  'normalMap',
  'occlusionMap',
  'diffuseMap',
  'specularGlossinessMap'
]

function Material (opts) {
  this.type = 'Material'
  this.id = 'Material_' + MaterialID++
  this.enabled = true
  this.changed = new Signal()

  this._uniforms = {}

  const ctx = opts.ctx

  this.baseColor = [1, 1, 1, 1]
  this.baseColorMap = null

  this.useSpecularGlossinessWorkflow = opts.useSpecularGlossinessWorkflow || false
  this.unlit = opts.unlit || false
  if (opts.useSpecularGlossinessWorkflow) {
    // Specular Glossiness workflow
    this.diffuse = [1, 1, 1, 1]
    this.diffuseMap = null
    this.specular = [1, 1, 1]
    this.glossiness = 1
    this.specularGlossinessMap = null
  } else if (!this.unlit) {
    // Metallic Roughness workflow
    this.metallic = 1
    this.matallicMap = null
    this.roughness = 1
    this.roughnessMap = null
    this.metallicRoughnessMap = null
  }

  this.normalMap = null
  this.normalScale = 1

  this.displacementMap = null
  this.displacement = 0

  this.emissiveColor = [0, 0, 0, 1]
  this.emissiveIntensity = 1
  this.emissiveColorMap = null

  this.occlusionMap = null

  this.reflectance = 0.5
  this.clearCoat = null
  this.clearCoatRoughness = null
  this.clearCoatNormalMap = null
  this.clearCoatNormalMapScale = 1

  this.alphaMap = null
  this.alphaTest = undefined
  this.depthTest = true
  this.depthWrite = true
  this.depthFunc = ctx.DepthFunc.LessEqual
  this.blend = false
  this.blendSrcRGBFactor = ctx.BlendFactor.One
  this.blendSrcAlphaFactor = ctx.BlendFactor.One
  this.blendDstRGBFactor = ctx.BlendFactor.One
  this.blendDstAlphaFactor = ctx.BlendFactor.One
  this.cullFace = true
  this.cullFaceMode = ctx.Face.Back

  this.castShadows = false
  this.receiveShadows = false

  this.set(opts)
}

Material.prototype.init = function (entity) {
  this.entity = entity
}

Material.prototype.set = function (opts) {
  Object.assign(this, opts)

  const optsKeys = Object.keys(opts)

  const mapKeys = optsKeys.filter(opt => MATERIAL_MAPS.includes(opt))
  if (mapKeys.length) {
    for (let i = 0; i < mapKeys.length; i++) {
      const map = this[mapKeys[i]]
      if (map.texture) {
        map.texCoordTransformMatrix = mat3FromTranslationRotationScale(
          map.offset || [0, 0],
          -map.rotation || 0,
          map.scale || [1, 1]
        )
      }
    }
  }

  optsKeys.forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new Material(opts)
}
