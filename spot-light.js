const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')
const Quat = require('pex-math/Quat')

function SpotLight (opts) {
  this.type = 'SpotLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.angle = Math.PI / 12
  this.direction = [0, -1, 0]
  this.distance = 10
  this.castShadows = false
  this.drawDebug = false

  this.set(opts)
}

SpotLight.prototype.init = function (entity) {
  this.entity = entity
}

SpotLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

SpotLight.prototype._drawDebug = function (opts) {
  const lineBuilder = opts.lineBuilder
  lineBuilder.addPrism({
    position: this.entity.transform.worldPosition,
    radius: 0.3
  })

  const spotLightRadius = this.distance * Math.tan(this.angle)

  const lines = [
    [spotLightRadius, 0, this.distance],
    [-spotLightRadius, 0, this.distance],
    [0, spotLightRadius, this.distance],
    [0, -spotLightRadius, this.distance]
  ]

  const rotation = Quat.fromDirection(Quat.create(), this.direction)

  lines.forEach((line) => {
    lineBuilder.addLine(
      Vec3.copy(this.entity.transform.worldPosition),
      Vec3.add(Vec3.multQuat(line, rotation), this.entity.transform.worldPosition)
    )
  })
}

module.exports = function (opts) {
  return new SpotLight(opts)
}
