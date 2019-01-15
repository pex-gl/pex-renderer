const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const log = require('debug')('pex-renderer:directional-light')

function DirectionalLight (opts) {
  this.type = 'DirectionalLight'
  this.enabled = true
  this.changed = new Signal()
  this.shadows = false
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.bias = 0.1
  this.castShadows = false

  const ctx = opts.ctx
  this._ctx = ctx

  this._left = -10
  this._right = 10
  this._bottom = -10
  this._top = 10
  this._near = 2
  this._far = 40

  this._viewMatrix = mat4.create()
  this._projectionMatrix = mat4.create()

  this.set(opts)
}

DirectionalLight.prototype.init = function (entity) {
  this.entity = entity
}

DirectionalLight.prototype.set = function (opts) {
  Object.assign(this, opts)
  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.castShadows && !this._ctx.capabilities.depthTexture) {
    console.warn('DirectionalLight.castShadows is not supported. WEBGL_depth_texture missing.')
    this.castShadows = false
  }

  if (this.castShadows) {
    if (!this._colorMap) this.allocateResources()
  } else {
    if (this._colorMap) this.disposeResources()
  }
}

DirectionalLight.prototype.allocateResources = function () {
  log('allocatedResources')

  const ctx = this._ctx

  this._colorMap = ctx.texture2D({
    name: 'directionalLightColorMap',
    width: 1024,
    height: 1024,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear
  })

  this._shadowMap = ctx.texture2D({
    name: 'directionalLightShadowMap',
    width: 1024,
    height: 1024,
    pixelFormat: ctx.PixelFormat.Depth,
    encoding: ctx.Encoding.Linear
  })

  this._shadowMapDrawCommand = {
    name: 'DirectionalLight.shadowMap',
    pass: ctx.pass({
      name: 'DirectionalLight.shadowMap',
      color: [ this._colorMap ],
      depth: this._shadowMap,
      clearColor: [0, 0, 0, 1],
      clearDepth: 1
    }),
    viewport: [0, 0, 1024, 1024] // TODO: viewport bug
    // colorMask: [0, 0, 0, 0] // TODO
  }
}

DirectionalLight.prototype.disposeResources = function () {
  log('disposeResources')

  const ctx = this._ctx

  ctx.dispose(this._colorMap)
  this._colorMap = null

  ctx.dispose(this._shadowMap)
  this._shadowMap = null

  ctx.dispose(this._shadowMapDrawCommand.pipeline)
  this._shadowMapDrawCommand = null
}

module.exports = function (opts) {
  return new DirectionalLight(opts)
}
