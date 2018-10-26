const Signal = require('signals')
const vec3 = require('pex-math/vec3')
const vec4 = require('pex-math/vec4')
const mat4 = require('pex-math/mat4')
const aabb = require('pex-geom/aabb')

function vec4set4 (v, x, y, z, w) {
  v[0] = x
  v[1] = y
  v[2] = z
  v[3] = w
  return v
}

// TODO remove, should in AABB
function emptyAABB (a) {
  a[0][0] = Infinity
  a[0][1] = Infinity
  a[0][2] = Infinity
  a[1][0] = -Infinity
  a[1][1] = -Infinity
  a[1][2] = -Infinity
}

// TODO remove, should in AABB
function aabbToPoints (points, box) {
  vec4set4(points[0], box[0][0], box[0][1], box[0][2], 1)
  vec4set4(points[1], box[1][0], box[0][1], box[0][2], 1)
  vec4set4(points[2], box[1][0], box[0][1], box[1][2], 1)
  vec4set4(points[3], box[0][0], box[0][1], box[1][2], 1)
  vec4set4(points[4], box[0][0], box[1][1], box[0][2], 1)
  vec4set4(points[5], box[1][0], box[1][1], box[0][2], 1)
  vec4set4(points[6], box[1][0], box[1][1], box[1][2], 1)
  vec4set4(points[7], box[0][0], box[1][1], box[1][2], 1)
  return points
}

function aabbFromPoints (aabb, points) {
  var min = aabb[0]
  var max = aabb[1]

  for (var i = 0, len = points.length; i < len; i++) {
    var p = points[i]
    min[0] = Math.min(min[0], p[0])
    min[1] = Math.min(min[1], p[1])
    min[2] = Math.min(min[2], p[2])
    max[0] = Math.max(max[0], p[0])
    max[1] = Math.max(max[1], p[1])
    max[2] = Math.max(max[2], p[2])
  }

  return aabb
}

function Transform (opts) {
  this.type = 'Transform'
  this.entity = null
  this.changed = new Signal()
  this.position = [0, 0, 0]
  this.worldPosition = [0, 0, 0]
  this.rotation = [0, 0, 0, 1]
  this.scale = [1, 1, 1]
  this.parent = null
  this.children = []
  this.enabled = true
  // bounds of this node and it's children
  this.bounds = aabb.create()
  this._boundsPoints = new Array(8).fill(0).map(() => vec4.create())
  // bounds of this node and it's children in the world space
  this.worldBounds = aabb.create()
  this.localModelMatrix = mat4.create()
  this.modelMatrix = mat4.create()
  this.geometry = null
  this.set(opts)
}

Transform.prototype.init = function (entity) {
  this.entity = entity
}

Transform.prototype.set = function (opts) {
  if (opts.parent !== undefined) {
    if (this.parent) {
      this.parent.children.splice(this.parent.children.indexOf(this), 1)
    }
    if (opts.parent) {
      opts.parent.children.push(this)
    }
  }
  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Transform.prototype.update = function () {
  mat4.identity(this.localModelMatrix)
  mat4.translate(this.localModelMatrix, this.position)
  mat4.mult(this.localModelMatrix, mat4.fromQuat(mat4.create(), this.rotation))
  mat4.scale(this.localModelMatrix, this.scale)
  if (this.matrix) mat4.mult(this.localModelMatrix, this.matrix)

  mat4.identity(this.modelMatrix)
  var parents = []
  var parent = this
  while (parent) {
    parents.unshift(parent) // TODO: GC
    parent = parent.parent
  }
  parents.forEach((p) => { // TODO: forEach
    mat4.mult(this.modelMatrix, p.localModelMatrix)
  })

  emptyAABB(this.bounds)
  const geom = this.entity.getComponent('Geometry')
  if (geom) {
    aabb.set(this.bounds, geom.bounds)
  }
}

Transform.prototype.afterUpdate = function () {
  if (!aabb.isEmpty(this.bounds)) {
    aabbToPoints(this._boundsPoints, this.bounds)
    for (var i = 0; i < this._boundsPoints.length; i++) {
      vec3.multMat4(this._boundsPoints[i], this.modelMatrix)
    }
    aabbFromPoints(this.worldBounds, this._boundsPoints)
  } else {
    emptyAABB(this.worldBounds)
  }
  this.children.forEach((child) => {
    if (!aabb.isEmpty(child.worldBounds)) {
      aabb.includeAABB(this.worldBounds, child.worldBounds)
    }
  })
  vec3.scale(this.worldPosition, 0)
  vec3.multMat4(this.worldPosition, this.modelMatrix)
}

module.exports = function createTransform (opts) {
  return new Transform(opts)
}
