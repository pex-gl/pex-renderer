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
  if (this.frustum) {
    x += this.frustum.offset[0]
    y += this.frustum.offset[1]
    windowWidth = this.frustum.totalSize[0]
    windowHeight = this.frustum.totalSize[1]
  }
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

function normalizePlane(plane) {
  const mag = vec3.length(plane)
  return plane.map(p => p / mag)
}

Camera.prototype.getFrustum = function () {
  const [
    m00,
    m01,
    m02,
    m03,
    m10,
    m11,
    m12,
    m13,
    m20,
    m21,
    m22,
    m23,
    m30,
    m31,
    m32,
    m33
  ] = mat4.mult([...this.inverseViewMatrix], this.projectionMatrix)

  // Get planes
  return [
    normalizePlane([m30 + m00, m31 + m01, m32 + m02, m33 + m03]), // Left
    normalizePlane([m30 - m00, m31 - m01, m32 - m02, m33 - m03]), // Right
    normalizePlane([m30 + m10, m31 + m11, m32 + m12, m33 + m13]), // Bottom
    normalizePlane([m30 - m10, m31 - m11, m32 - m12, m33 - m13]), // Top
    normalizePlane([m30 + m20, m31 + m21, m32 + m22, m33 + m23]), // Near
    normalizePlane([m30 - m20, m31 - m21, m32 - m22, m33 - m23]), // Far
  ]
}

Camera.prototype.update = function () {
  mat4.set(this.inverseViewMatrix, this.entity.transform.modelMatrix)
  mat4.set(this.viewMatrix, this.entity.transform.modelMatrix)
  mat4.invert(this.viewMatrix)
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
