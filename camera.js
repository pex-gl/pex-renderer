const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')

function normalizePlane(plane) {
  const mag = vec3.length(plane)
  return plane.map(p => p / mag)
}

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
  this.frustum = []
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

  let hNear = 2 * Math.tan(this.fov / 2) * this.near
  let wNear = hNear * this.aspect

  nx *= (wNear * 0.5)
  ny *= (hNear * 0.5)

  let origin = [0, 0, 0]
  let direction = vec3.normalize([nx, ny, -this.near])
  let ray = [origin, direction]

  return ray
}

Camera.prototype.update = function () {
  mat4.set(this.inverseViewMatrix, this.entity.transform.modelMatrix)
  mat4.set(this.viewMatrix, this.entity.transform.modelMatrix)
  mat4.invert(this.viewMatrix)

  const m = mat4.mult(mat4.copy(this.projectionMatrix), mat4.copy(this.viewMatrix))

  this.frustum = [
    normalizePlane([m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]]), // -x
    normalizePlane([m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]]), // +x
    normalizePlane([m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]]), // +y
    normalizePlane([m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]]), // -y
    normalizePlane([m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]]), // +z (far)
    normalizePlane([m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]]), // -z (near)
  ]
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
