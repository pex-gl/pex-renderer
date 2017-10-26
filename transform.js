const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')
const AABB = require('pex-geom/AABB')

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
function aabbToPoints (aabb) {
  if (AABB.isEmpty(aabb)) return []
  return [
    [aabb[0][0], aabb[0][1], aabb[0][2], 1],
    [aabb[1][0], aabb[0][1], aabb[0][2], 1],
    [aabb[1][0], aabb[0][1], aabb[1][2], 1],
    [aabb[0][0], aabb[0][1], aabb[1][2], 1],
    [aabb[0][0], aabb[1][1], aabb[0][2], 1],
    [aabb[1][0], aabb[1][1], aabb[0][2], 1],
    [aabb[1][0], aabb[1][1], aabb[1][2], 1],
    [aabb[0][0], aabb[1][1], aabb[1][2], 1]
  ]
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
  this.bounds = AABB.create()
  // bounds of this node and it's children in the world space
  this.worldBounds = AABB.create()
  this.localModelMatrix = Mat4.create()
  this.modelMatrix = Mat4.create()
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
  Mat4.identity(this.localModelMatrix)
  Mat4.translate(this.localModelMatrix, this.position)
  Mat4.mult(this.localModelMatrix, Mat4.fromQuat(Mat4.create(), this.rotation))
  Mat4.scale(this.localModelMatrix, this.scale)
  if (this.matrix) Mat4.mult(this.localModelMatrix, this.matrix)

  Mat4.identity(this.modelMatrix)
  var parents = []
  var parent = this
  while (parent) {
    parents.unshift(parent)
    parent = parent.parent
  }
  parents.forEach((p) => {
    Mat4.mult(this.modelMatrix, p.localModelMatrix)
  })

  emptyAABB(this.bounds)
  const geom = this.entity.getComponent('Geometry')
  if (geom) {
    AABB.set(this.bounds, geom.bounds)
  }
}

Transform.prototype.afterUpdate = function () {
  if (!AABB.isEmpty(this.bounds)) {
    const points = aabbToPoints(this.bounds)
    const pointsInWorldSpace = points.map((p) => Vec3.multMat4(Vec3.copy(p), this.modelMatrix))
    this.worldBounds = AABB.fromPoints(pointsInWorldSpace)
  } else {
    emptyAABB(this.worldBounds)
  }
  this.children.forEach((child) => {
    if (!AABB.isEmpty(child.worldBounds)) {
      AABB.includeAABB(this.worldBounds, child.worldBounds)
    }
  })
  Vec3.scale(this.worldPosition, 0)
  Vec3.multMat4(this.worldPosition, this.modelMatrix)
}

module.exports = function createTransform (opts) {
  return new Transform(opts)
}
