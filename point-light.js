const Signal = require('signals')
const createLineBuilder = require('./line-builder')
const lineBuilder = createLineBuilder()

function PointLight (opts) {
  this.type = 'PointLight'
  this.changed = new Signal()
  this.color = [1, 1, 1, 1]
  this.intensity = 1
  this.radius = 10
  this.castShadows = false
  this.shouldDrawGizmo = false

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

PointLight.prototype.drawGizmo = function (opts) {
  const ctx = opts.ctx
  const renderer = opts.renderer
  if (this.shouldDrawGizmo) {
    lineBuilder.makePrism({ radius: 0.3 })
    lineBuilder.makeCircle({
      center: [0, 0, 0], radius: this.radius, steps: 64, axis: [0, 1]
    })
    lineBuilder.makeCircle({
      center: [0, 0, 0], radius: this.radius, steps: 64, axis: [0, 2]
    })
    lineBuilder.makeCircle({
      center: [0, 0, 0], radius: this.radius, steps: 64, axis: [1, 2]
    })

    lineBuilder.addLine([0, 0.3, 0], [0, 0.6, 0])
    lineBuilder.addLine([0, -0.3, 0], [0, -0.6, 0])
    lineBuilder.addLine([0.3, 0, 0], [0.6, 0, 0])
    lineBuilder.addLine([-0.3, 0, 0], [-0.6, 0, 0])
    lineBuilder.addLine([0, 0, 0.3], [0, 0, 0.6])
    lineBuilder.addLine([0, 0, -0.3], [0, 0, -0.6])

    const positions = lineBuilder.getPositions()

    if (!this.gizmoEntity) {
      const transformCmp = this.entity.getComponent('Transform')
      let position = [0, 0, 0]
      if (transformCmp) position = transformCmp.position
      this.gizmoEntity = renderer.entity([
        renderer.transform({
          position: position,
        }),
        renderer.geometry({
          positions: positions,
          primitive: opts.ctx.Primitive.Lines,
          count: positions.length
        }),
        renderer.material({
          baseColor: [1, 1, 1, 1]
        }),
      ], ['geometryGizmo'])
      renderer.add(this.gizmoEntity)
    } else {
      this.gizmoEntity.getComponent('Geometry').set({
        positions: positions,
        count: positions.length
      })
    }
  } else {
    renderer.remove(this.gizmoEntity)
  }

  lineBuilder.reset()
}

module.exports = function (opts) {
  return new PointLight(opts)
}
