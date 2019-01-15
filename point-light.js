const Signal = require('signals')
const mat4 = require('pex-math').mat4

function PointLight (opts) {
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
  const CUBEMAP_SIZE = 512
  const shadowCubemap = this._shadowCubemap = ctx.textureCube({
    width: CUBEMAP_SIZE,
    height: CUBEMAP_SIZE,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })
  this._shadowMap = ctx.texture2D({
    name: 'directionalLightShadowMap',
    width: 512,
    height: 512,
    pixelFormat: ctx.PixelFormat.Depth,
    encoding: ctx.Encoding.Linear
  })

  const sides = this._sides = [
    { eye: [0, 0, 0], target: [1, 0, 0], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
    { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
    { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
    { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] }
  ].map((side, i) => {
    side.projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 2, 1, 0.1, 100) // TODO: change this to radians
    side.viewMatrix = mat4.lookAt(mat4.create(), side.eye, side.target, side.up)
    side.drawPassCmd = {
      name: 'ReflectionProbe.sidePass',
      pass: ctx.pass({
        name: 'ReflectionProbe.sidePass',
        depth: this._shadowMap,
        color: [{ texture: shadowCubemap, target: ctx.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i }],
        clearColor: [0, 0, 0, 1],
        clearDepth: 1
      })
    }
    return side
  })
}

PointLight.prototype.init = function (entity) {
  this.entity = entity
}

PointLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

module.exports = function (opts) {
  return new PointLight(opts)
}
