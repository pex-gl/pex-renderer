import Signal from "signals";
import { vec3, vec4, mat4 } from "pex-math";
import { aabb } from "pex-geom";

function vec4set4(v, x, y, z, w) {
  v[0] = x;
  v[1] = y;
  v[2] = z;
  v[3] = w;
  return v;
}

// TODO remove, should in AABB
function emptyAABB(a) {
  a[0][0] = Infinity;
  a[0][1] = Infinity;
  a[0][2] = Infinity;
  a[1][0] = -Infinity;
  a[1][1] = -Infinity;
  a[1][2] = -Infinity;
}

// TODO remove, should in AABB
function aabbToPoints(points, box) {
  vec4set4(points[0], box[0][0], box[0][1], box[0][2], 1);
  vec4set4(points[1], box[1][0], box[0][1], box[0][2], 1);
  vec4set4(points[2], box[1][0], box[0][1], box[1][2], 1);
  vec4set4(points[3], box[0][0], box[0][1], box[1][2], 1);
  vec4set4(points[4], box[0][0], box[1][1], box[0][2], 1);
  vec4set4(points[5], box[1][0], box[1][1], box[0][2], 1);
  vec4set4(points[6], box[1][0], box[1][1], box[1][2], 1);
  vec4set4(points[7], box[0][0], box[1][1], box[1][2], 1);
  return points;
}

function aabbFromPoints(aabb, points) {
  const min = aabb[0];
  const max = aabb[1];

  for (let i = 0, len = points.length; i < len; i++) {
    const p = points[i];
    min[0] = Math.min(min[0], p[0]);
    min[1] = Math.min(min[1], p[1]);
    min[2] = Math.min(min[2], p[2]);
    max[0] = Math.max(max[0], p[0]);
    max[1] = Math.max(max[1], p[1]);
    max[2] = Math.max(max[2], p[2]);
  }

  return aabb;
}

const tempMat4multQuatMat4 = mat4.create();
function mat4multQuat(m, q) {
  mat4.fromQuat(tempMat4multQuatMat4, q);
  mat4.mult(m, tempMat4multQuatMat4);
  return m;
}

class Transform {
  constructor(opts) {
    this.type = "Transform";
    this.enabled = true;
    this.changed = new Signal();
    this.entity = null;
    this.position = [0, 0, 0];
    this.worldPosition = [0, 0, 0];
    this.rotation = [0, 0, 0, 1];
    this.scale = [1, 1, 1];
    this.parent = null;
    this.children = [];
    // bounds of this node and it's children
    this.bounds = aabb.create();
    this._boundsPoints = new Array(8).fill(0).map(() => vec4.create());
    // bounds of this node and it's children in the world space
    this.worldBounds = aabb.create();
    this.localModelMatrix = mat4.create();
    this.modelMatrix = mat4.create();
    this.geometry = null;
    this.set(opts);
  }

  init(entity) {
    this.entity = entity;
  }

  set(opts) {
    if (opts.parent !== undefined) {
      if (this.parent) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
      }
      if (opts.parent) {
        opts.parent.children.push(this);
      }
    }
    Object.assign(this, opts);
    Object.keys(opts).forEach((prop) => this.changed.dispatch(prop));
  }

  update() {
    mat4.identity(this.localModelMatrix);
    mat4.translate(this.localModelMatrix, this.position);
    mat4multQuat(this.localModelMatrix, this.rotation);
    mat4.scale(this.localModelMatrix, this.scale);
    if (this.matrix) mat4.mult(this.localModelMatrix, this.matrix);

    mat4.identity(this.modelMatrix);
    const parents = [];
    let parent = this;
    while (parent) {
      parents.unshift(parent); // TODO: GC
      parent = parent.parent;
    }
    parents.forEach(({ localModelMatrix }) => {
      // TODO: forEach
      mat4.mult(this.modelMatrix, localModelMatrix);
    });

    emptyAABB(this.bounds);
    const geom = this.entity.getComponent("Geometry");
    if (geom) {
      aabb.set(this.bounds, geom.bounds);
    }
  }

  afterUpdate() {
    emptyAABB(this.worldBounds);
    if (!aabb.isEmpty(this.bounds)) {
      aabbToPoints(this._boundsPoints, this.bounds);
      for (let i = 0; i < this._boundsPoints.length; i++) {
        vec3.multMat4(this._boundsPoints[i], this.modelMatrix);
      }
      aabbFromPoints(this.worldBounds, this._boundsPoints);
    }
    this.children.forEach(({ worldBounds }) => {
      if (!aabb.isEmpty(worldBounds)) {
        aabb.includeAABB(this.worldBounds, worldBounds);
      }
    });
    vec3.scale(this.worldPosition, 0);
    vec3.multMat4(this.worldPosition, this.modelMatrix);
  }
}

export default function createTransform(opts) {
  return {
    position: [0, 0, 0],
  };
}
