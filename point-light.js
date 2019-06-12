const Signal = require('signals')
const mat4 = require('pex-math').mat4

function PointLight(opts) {
  this.type = 'PointLight'
  this.enabled = true
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.range = 10
  this.castShadows = false

  const ctx = opts.ctx
  this._ctx = ctx

  this.set(opts)
}

PointLight.prototype.init = function(entity) {
  this.entity = entity
}

PointLight.prototype.set = function(opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }

  if (opts.castShadows && !this._ctx.capabilities.depthTexture) {
    console.warn(
      'PointLight.castShadows is not supported. WEBGL_depth_texture missing.'
    )
    this.castShadows = false
  }
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (this.castShadows) {
    if (!this._shadowCubemap) this.allocateResources()
  } else {
    if (this._shadowCubemap) this.disposeResources()
  }
}

PointLight.prototype.allocateResources = function() {
  const ctx = this._ctx

  const CUBEMAP_SIZE = 512
  this._shadowCubemap = ctx.textureCube({
    width: CUBEMAP_SIZE,
    height: CUBEMAP_SIZE,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })
  this._shadowMap = ctx.texture2D({
    name: 'pointLightShadowMap',
    width: CUBEMAP_SIZE,
    height: CUBEMAP_SIZE,
    pixelFormat: ctx.PixelFormat.Depth,
    encoding: ctx.Encoding.Linear
  })

  this._sides = [
    { eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
    { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
    { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] }
  ].map((side, i) => {
    side.projectionMatrix = mat4.perspective(
      mat4.create(),
      Math.PI / 2,
      1,
      0.1,
      100
    ) // TODO: change this to radians
    side.viewMatrix = mat4.lookAt(mat4.create(), side.eye, side.target, side.up)
    side.drawPassCmd = {
      name: 'PointLight.sidePass',
      pass: ctx.pass({
        name: 'PointLight.sidePass',
        depth: this._shadowMap,
        color: [
          {
            texture: this._shadowCubemap,
            target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i
          }
        ],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1
      })
    }
    return side
  })
}

PointLight.prototype.disposeResources = function() {
  const ctx = this._ctx

  ctx.dispose(this._shadowCubemap)
  this._shadowCubemap = null

  ctx.dispose(this._shadowMap)
  this._shadowMap = null

  this._sides.forEach((side) => {
    ctx.dispose(side.drawPassCmd.pass)
  })
  this._sides = null
}

module.exports = function(opts) {
  return new PointLight(opts)
}
