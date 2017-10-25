const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')
const AABB = require('pex-geom/AABB')

// TODO ?
function multVec3 (a, b) {
  a[0] *= b[0]
  a[1] *= b[1]
  a[2] *= b[2]
}

// TODO remove, should in AABB
function emptyABBB (a) {
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
  this.dirty = true
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
  this.geometry = entity.getComponent('Geometry')
  if (this.geometry) {
    this.geometry.changed.add((prop) => {
      if (prop === 'bounds') {
        // TODO: not needed? transform is live and updates every frame?
        this.dirty = true
      }
    })
  }
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
  this.dirty = true
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

  emptyABBB(this.bounds)
  if (this.geometry) {
    AABB.set(this.bounds, this.geometry.bounds)
  }
}

Transform.prototype.afterUpdate = function () {
  this.children.forEach((child) => {
    let childBounds = AABB.copy(child.bounds)
    multVec3(childBounds[0], child.scale)
    multVec3(childBounds[1], child.scale)
    Vec3.add(childBounds[0], child.position)
    Vec3.add(childBounds[1], child.position)
    if (child.matrix) {
      Vec3.multMat4(childBounds[0], child.matrix)
      Vec3.multMat4(childBounds[1], child.matrix)
    }
    AABB.includeAABB(this.bounds, childBounds)
  })

  if (AABB.isEmpty(this.bounds)) {
    AABB.includePoint(this.bounds, [0, 0, 0])
  }

  const points = aabbToPoints(this.bounds)
  const pointsInWorldSpace = points.map((p) => Vec3.multMat4(Vec3.copy(p), this.modelMatrix))
  this.worldBounds = AABB.fromPoints(pointsInWorldSpace)
  Vec3.scale(this.worldPosition, 0)
  Vec3.multMat4(this.worldPosition, this.modelMatrix)
}

module.exports = function createTransform (opts) {
  return new Transform(opts)
}
