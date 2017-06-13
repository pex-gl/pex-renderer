const Signal = require('signals')
const Mat4 = require('pex-math/Mat4')
const Vec3 = require('pex-math/Vec3')

function DirectionalLight (opts) {
  const ctx = opts.ctx

  this.type = 'DirectionalLight'
  this.changed = new Signal()
  this.shadows = false
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.direction = [1, -1, 0]
  this.bias = 0.1
  this.castShadows = false
  this.drawDebug = false

  this._left = -10
  this._right = 10
  this._bottom = -10
  this._top = 10
  this._near = 2
  this._far = 40

  this._prevDirection = [0, 0, 0]

  this._colorMap = ctx.texture2D({
    width: 1024,
    height: 1024,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.Linear
  })
  this._shadowMap = ctx.texture2D({
    width: 1024,
    height: 1024,
    pixelFormat: ctx.PixelFormat.Depth,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
    encoding: ctx.Encoding.Linear
  })
  this._viewMatrix = Mat4.create()
  this._projectionMatrix = Mat4.create()

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

  this.set(opts)
}

DirectionalLight.prototype.init = function (entity) {
  this.entity = entity
}

DirectionalLight.prototype.set = function (opts) {
  Object.assign(this, opts)
  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity;
  }
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

DirectionalLight.prototype._drawDebug = function (opts) {
  const lineBuilder = opts.lineBuilder
  lineBuilder.addPrism({
    position: this.entity.transform.worldPosition,
    radius: 0.3
  })
  const lines = [
    [0, 0, 0.3],
    [0.3, 0, 0],
    [-0.3, 0, 0],
    [0, 0.3, 0],
    [0, -0.3, 0],
    [0, 0, -0.3]
  ]

  lines.forEach((line) => {
    lineBuilder.addLine(
      Vec3.add(Vec3.copy(line), this.entity.transform.worldPosition),
      Vec3.add(Vec3.add(Vec3.copy(line), this.entity.transform.worldPosition), this.direction)
    )
  })
}

module.exports = function (opts) {
  return new DirectionalLight(opts)
}
