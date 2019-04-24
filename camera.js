const Signal = require('signals')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')

function Camera (opts) {
  const gl = opts.ctx.gl
  this.type = 'Camera'
  this.projection = opts.projection || 'perspective'
  this.enabled = true
  this.changed = new Signal()

  this.near = 0.1
  this.far = 100
  this.aspect = 1
  this.exposure = 1

  this.viewMatrix = mat4.create()
  this.inverseViewMatrix = mat4.create()

  if (this.projection === 'perspective') {
    this.fov = Math.PI / 4

    this.projectionMatrix = mat4.perspective(
      mat4.create(),
      this.fov,
      this.aspect,
      this.near,
      this.far
    )
  } else if (this.projection === 'orthographic') {
    this.left = -1
    this.right = 1
    this.bottom = -1
    this.top = 1
    this.zoom = 1

    this.projectionMatrix = mat4.ortho(
      mat4.create(),
      this.left,
      this.right,
      this.bottom,
      this.top,
      this.near,
      this.far
    )
  }

  this.viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]

  this.set(opts)
}

Camera.prototype.init = function (entity) {
  this.entity = entity
}

Camera.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (
    this.projection === 'perspective' &&
    (opts.aspect || opts.near || opts.far || opts.fov)
  ) {
    mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far)
  } else if (
    this.projection === 'orthographic' &&
    (opts.left || opts.right || opts.bottom || opts.top || opts.zoom || opts.near || opts.far)
  ) {
    const dx = (this.right - this.left) / (2 / this.zoom)
    const dy = (this.top - this.bottom) / (2 / this.zoom)
    const cx = (this.right + this.left) / 2
    const cy = (this.top + this.bottom) / 2

    const left = cx - dx
    const right = cx + dx
    const top = cy + dy
    const bottom = cy - dy

    mat4.ortho(
      this.projectionMatrix,
      left,
      right,
      bottom,
      top,
      this.near,
      this.far
    )
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

Camera.prototype.update = function () {
  mat4.set(this.inverseViewMatrix, this.entity.transform.modelMatrix)
  mat4.set(this.viewMatrix, this.entity.transform.modelMatrix)
  mat4.invert(this.viewMatrix)
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
