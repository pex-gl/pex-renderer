const Signal = require('signals')

function Camera (opts) {
  this.type = 'Camera'
  this.changed = new Signal()

  this.set(opts)
}

Camera.prototype.init = function (entity) {
  this.entity = entity
}

Camera.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.camera) {
    const camera = this.camera = opts.camera
    this.projectionMatrix = camera.projectionMatrix
    this.viewMatrix = camera.viewMatrix
    this.position = camera.position
    this.target = this.target
    this.up = camera.up
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Camera.prototype.update = function () {
  // TODO: copy position from camera to transform on camera change
  // TODO: copy position from transform to camera on transform change?
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
