const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')

function PointLight (opts) {
  this.type = 'PointLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.radius = 10
  this.castShadows = false
  this.drawDebug = false

  this.set(opts)
}

PointLight.prototype.init = function (entity) {
  this.entity = entity
}

PointLight.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.color !== undefined || opts.intensity !== undefined) {
    this.color[3] = this.intensity;
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

PointLight.prototype._drawDebug = function (opts) {
  const lineBuilder = opts.lineBuilder
  lineBuilder.addPrism({
    position: this.entity.transform.worldPosition,
    radius: 0.3
  })
  lineBuilder.addCircle({
    center: this.entity.transform.worldPosition,
    radius: this.radius, steps: 64, axis: [0, 1]
  })
  lineBuilder.addCircle({
    center: this.entity.transform.worldPosition,
    radius: this.radius, steps: 64, axis: [0, 2]
  })
  lineBuilder.addCircle({
    center: this.entity.transform.worldPosition,
    radius: this.radius, steps: 64, axis: [1, 2]
  })

  const lines = [
    [[0, 0.3, 0], [0, 0.6, 0]],
    [[0, -0.3, 0], [0, -0.6, 0]],
    [[0.3, 0, 0], [0.6, 0, 0]],
    [[-0.3, 0, 0], [-0.6, 0, 0]],
    [[0, 0, 0.3], [0, 0, 0.6]],
    [[0, 0, -0.3], [0, 0, -0.6]]
  ]

  lines.forEach((line) => {
    lineBuilder.addLine(
      Vec3.add(line[0], this.entity.transform.worldPosition),
      Vec3.add(line[1], this.entity.transform.worldPosition)
    )
  })
}

module.exports = function (opts) {
  return new PointLight(opts)
}
