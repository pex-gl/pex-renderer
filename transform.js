import Signal from 'signals'
import { vec3, mat4 } from 'pex-math'
import { aabb } from 'pex-geom'

// TODO remove, should in AABB
function emptyAABB(a) {
  a[0][0] = Infinity
  a[0][1] = Infinity
  a[0][2] = Infinity
  a[1][0] = -Infinity
  a[1][1] = -Infinity
  a[1][2] = -Infinity
}

// TODO remove, should in AABB
function aabbToPoints(box) {
  if (aabb.isEmpty(box)) return []
  return [
    [box[0][0], box[0][1], box[0][2], 1],
    [box[1][0], box[0][1], box[0][2], 1],
    [box[1][0], box[0][1], box[1][2], 1],
    [box[0][0], box[0][1], box[1][2], 1],
    [box[0][0], box[1][1], box[0][2], 1],
    [box[1][0], box[1][1], box[0][2], 1],
    [box[1][0], box[1][1], box[1][2], 1],
    [box[0][0], box[1][1], box[1][2], 1]
  ]
}

class Transform {
  constructor(opts) {
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
    // bounds of this node and it's children in the world space
    this.worldBounds = aabb.create()
    this.localModelMatrix = mat4.create()
    this.modelMatrix = mat4.create()
    this.geometry = null
    this.set(opts)
  }

  init(entity) {
    this.entity = entity
  }

  set(opts) {
    if (opts.parent !== undefined) {
      if (this.parent) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1)
      }
      if (opts.parent) {
        opts.parent.children.push(this)
      }
    }
    Object.assign(this, opts)
    Object.keys(opts).forEach(prop => this.changed.dispatch(prop))
  }

  update() {
    mat4.identity(this.localModelMatrix)
    mat4.translate(this.localModelMatrix, this.position)
    mat4.mult(this.localModelMatrix, mat4.fromQuat(mat4.create(), this.rotation))
    mat4.scale(this.localModelMatrix, this.scale)
    if (this.matrix) mat4.mult(this.localModelMatrix, this.matrix)

    mat4.identity(this.modelMatrix)
    const parents = []
    let parent = this
    while (parent) {
      parents.unshift(parent) // TODO: GC
      parent = parent.parent
    }
    parents.forEach(p => {
      // TODO: forEach
      mat4.mult(this.modelMatrix, p.localModelMatrix)
    })

    emptyAABB(this.bounds)
    const geom = this.entity.getComponent('Geometry')
    if (geom) {
      aabb.set(this.bounds, geom.bounds)
    }
  }

  afterUpdate() {
    if (!aabb.isEmpty(this.bounds)) {
      const points = aabbToPoints(this.bounds)
      const pointsInWorldSpace = points.map(p => vec3.multMat4(vec3.copy(p), this.modelMatrix))
      this.worldBounds = aabb.fromPoints(pointsInWorldSpace)
    } else {
      emptyAABB(this.worldBounds)
    }
    this.children.forEach(child => {
      if (!aabb.isEmpty(child.worldBounds)) {
        aabb.includeAABB(this.worldBounds, child.worldBounds)
      }
    })
    vec3.scale(this.worldPosition, 0)
    vec3.multMat4(this.worldPosition, this.modelMatrix)
  }
}

export default function createTransform(opts) {
  return new Transform(opts)
}
