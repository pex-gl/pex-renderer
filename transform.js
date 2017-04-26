const Signal = require('signals')
const Vec3 = require('pex-math/Vec3')
const Mat4 = require('pex-math/Mat4')
const AABB = require('pex-geom/AABB')

function multVec3 (a, b) {
  a[0] *= b[0]
  a[1] *= b[1]
  a[2] *= b[2]
}

function emptyABBB (a) {
  a[0][0] = Infinity
  a[0][1] = Infinity
  a[0][2] = Infinity
  a[1][0] = -Infinity
  a[1][1] = -Infinity
  a[1][2] = -Infinity
}

function Transform (opts) {
  this.type = 'Transform'
  this.entity = null
  this.changed = new Signal()
  this.dirty = true
  this.position = [0, 0, 0]
  this.rotation = [0, 0, 0, 1]
  this.scale = [1, 1, 1]
  this.worldPosition = [0, 0, 0]
  this.worldScale = [1, 1, 1]
  this.parent = null
  this.children = []
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
  if (this.parent) {
    Vec3.set(this.worldPosition, this.position)
    Vec3.add(this.worldPosition, this.parent.worldPosition)
    Vec3.set(this.worldScale, this.scale)
    this.worldScale[0] *= this.parent.worldScale[0]
    this.worldScale[1] *= this.parent.worldScale[1]
    this.worldScale[2] *= this.parent.worldScale[2]

    // TODO: multiply that by parent model matrix to get global rotation
    Mat4.identity(this.modelMatrix)
    Mat4.translate(this.modelMatrix, this.worldPosition)
    // TODO: implement rotation
    // Mat4.rotate(this.modelMatrix, Mat4.fromQuat(Mat4.create(), this.worldRotation)
    Mat4.scale(this.modelMatrix, this.worldScale)
  }

  emptyABBB(this.bounds)
  if (this.geometry) {
    // AABB.set(this.bounds, this.geometry.bounds)
  }

  // TODO: update world bounds
  emptyABBB(this.worldBounds)
}

Transform.prototype.afterUpdate = function () {
  this.children.forEach((child) => {
    let childBounds = AABB.copy(child.bounds)
    multVec3(childBounds[0], child.scale)
    multVec3(childBounds[1], child.scale)
    Vec3.add(childBounds[0], child.position)
    Vec3.add(childBounds[1], child.position)
    AABB.includeAABB(this.bounds, childBounds)
  })

  if (AABB.isEmpty(this.bounds)) {
    // AABB.includePoint(this.bounds, [0, 0, 0])
  }

  AABB.set(this.worldBounds, this.bounds)

  multVec3(this.worldBounds[0], this.worldScale)
  multVec3(this.worldBounds[1], this.worldScale)
  Vec3.add(this.worldBounds[0], this.worldPosition)
  Vec3.add(this.worldBounds[1], this.worldPosition)
}

module.exports = function createTransform (opts) {
  return new Transform(opts)
}
