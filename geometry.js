const Signal = require('signals')
const aabb = require('pex-geom/aabb')

const AttributesMap = {
  positions: 'aPosition',
  normals: 'aNormal',
  tangents: 'aTangent',
  texCoords: 'aTexCoord0',
  uvs: 'aTexCoord0',
  vertexColors: 'aVertexColor',
  offsets: 'aOffset',
  scales: 'aScale',
  rotations: 'aRotation',
  colors: 'aColor',
  joints: 'aJoint',
  weights: 'aWeight'
}

const IndicesMap = {
  indices: 'indices',
  cells: 'indices'
}

function Geometry (opts) {
  this.type = 'Geometry'
  this.changed = new Signal()
  this.bounds = aabb.create()

  this.primitive = opts.ctx.Primitive.Triangles

  this.count = undefined
  this._indices = null
  this._attributes = { }

  this.set(opts)
}

Geometry.prototype.init = function (entity) {
  this.entity = entity
}

Geometry.prototype.set = function (opts) {
  const ctx = opts.ctx || this.ctx

  // This is a bit messy because indices will could ovewrite this.indices
  // so we have to use this._indices internally
  Object.assign(this, opts)

  for (let prop in opts) {
    const val = opts[prop]
    if (AttributesMap[prop]) {
      const attribName = AttributesMap[prop]
      let attrib = this._attributes[attribName]
      if (!attrib) {
        attrib = this._attributes[attribName] = {
          buffer: null,
          offset: 0,
          stride: 0,
          divisor: 0,
          type: ctx.DataType.Float32
        }
      }
      const data = (val.length !== undefined) ? val : val.data
      if (data) {
        if (!attrib.buffer) {
          attrib.buffer = ctx.vertexBuffer(data)
          // TODO: replace with ctx.DataType.fromArray(data)
          attrib.type = attrib.buffer.type // FIXE: deprecated
        } else {
          ctx.update(attrib.buffer, { data: data })
        }

        if (attribName === 'aPosition') {
          // If we have list of vectors we can calculate bounding box otherwise
          // the user has to provide it
          if (data[0].length) {
            this.bounds = opts.bounds || aabb.fromPoints(data)
          }
        }
      } else if (val.buffer) {
        // TODO: should we delete previous buffer?
        attrib.buffer = val.buffer
      }
      if (val.offset !== undefined) {
        attrib.offset = val.offset
      }
      if (val.stride !== undefined) {
        attrib.stride = val.stride
      }
      if (val.divisor !== undefined) {
        attrib.divisor = val.divisor
      }
      if (val.type !== undefined) {
        attrib.type = val.type
      }
    }

    if (IndicesMap[prop]) {
      const val = opts[prop]
      let indices = this._indices
      if (!indices) {
        indices = this._indices = {
          buffer: null,
          offset: 0,
          type: ctx.DataType.Uint16
        }
      }
      const data = (val.length !== undefined) ? val : val.data
      if (data) {
        if (!indices.buffer) {
          indices.buffer = ctx.indexBuffer(data)
          // TODO: replace with ctx.DataType.fromArray(data)
          indices.type = indices.buffer.type // FIXE: deprecated
        } else {
          ctx.update(indices.buffer, { data: data })
        }
      } else if (val.buffer) {
        // TODO: should we delete previous buffer?
        indices.buffer = val.buffer
      }
      if (val.offset !== undefined) {
        indices.offset = val.offset
      }
      if (val.type !== undefined) {
        indices.type = val.type
      }
      if (val.count !== undefined) {
        indices.count = val.count
      }
    }

    this.changed.dispatch(prop)
  }
}

module.exports = function (opts) {
  return new Geometry(opts)
}
