const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')

function Camera (opts) {
  const gl = opts.ctx.gl
  this.type = 'Camera'
  this.enabled = true
  this.changed = new Signal()

  this.fov = Math.PI / 4
  this.aspect = 1
  this.near = 0.1
  this.far = 100
  this.exposure = 1
  this.projectionMatrix = mat4.perspective(mat4.create(), this.fov, this.aspect, this.near, this.far)
  this.viewMatrix = mat4.create()
  this.inverseViewMatrix = mat4.create()

  this.viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]
  this._textures = []

  this.set(opts)
}

Camera.prototype.init = function (entity) {
  this.entity = entity
}

Camera.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.camera) {
    // const camera = this.camera = opts.camera
    // this.projectionMatrix = camera.projectionMatrix
    // this.viewMatrix = camera.viewMatrix
    // this.position = camera.position
    // this.target = this.target
    // this.up = camera.up
  }

  if (opts.aspect || opts.near || opts.far || opts.fov) {
    mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far)
  }

  if (opts.viewport) {
    const viewport = opts.viewport
    const aspect = viewport[2] / viewport[3]

    if (this.aspect !== aspect) {
      this.set({ aspect })
    }

    const postProcessingCmp = this.entity && this.entity.getComponent('PostProcessing')
    if (postProcessingCmp) {
      postProcessingCmp.set({
        viewport,
        viewMatrix: this.viewMatrix
      })
    }
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Camera.prototype.getViewRay = function (x, y, windowWidth, windowHeight) {
  let nx = 2 * x / windowWidth - 1
  let ny = 1 - 2 * y / windowHeight

  const hNear = 2 * Math.tan(this.fov / 2) * this.near
  const wNear = hNear * this.aspect

  nx *= (wNear * 0.5)
  ny *= (hNear * 0.5)

  // [origin, direction]
  return [[0, 0, 0], vec3.normalize([nx, ny, -this.near])]
}

Camera.prototype.update = function () {
  mat4.set(this.inverseViewMatrix, this.entity.transform.modelMatrix)
  mat4.set(this.viewMatrix, this.entity.transform.modelMatrix)
  mat4.invert(this.viewMatrix)
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
