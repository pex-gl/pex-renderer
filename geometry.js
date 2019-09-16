const Signal = require('signals')
const aabb = require('pex-geom/aabb')

const AttributesMap = {
  positions: 'aPosition',
  normals: 'aNormal',
  tangents: 'aTangent',
  texCoords: 'aTexCoord0',
  texCoords1: 'aTexCoord1',
  uvs: 'aTexCoord0',
  uvs2: 'aTexCoord1',
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

function Geometry(opts) {
  this.type = 'Geometry'
  this.enabled = true
  this.changed = new Signal()
  this.bounds = aabb.create()

  this.primitive = opts.ctx.Primitive.Triangles

  this.count = undefined
  this._indices = null
  this._attributes = {}

  this.set(opts)
}

Geometry.prototype.init = function(entity) {
  this.entity = entity
}

Geometry.prototype.set = function(opts) {
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
          type: undefined
        }
      }
      const data = val.length !== undefined ? val : val.data

      // TODO: test different type configurations
      if (data) {
        if (!attrib.buffer) {
          attrib.buffer = ctx.vertexBuffer({
            data: data,
            type: val.type || attrib.type
          })
        } else {
          ctx.update(attrib.buffer, {
            data: data,
            type: val.type || attrib.type,
            offset: attrib.offset || 0
          })
        }

        if (attribName === 'aPosition') {
          // If we have list of vectors we can calculate bounding box otherwise
          // the user has to provide it
          if (data[0].length) {
            this.bounds = opts.bounds || aabb.fromPoints(data)
          }
        }
      } else if (val.buffer) {
        // can we read data from the buffer
        // TODO: should we delete previous buffer?
        attrib.buffer = val.buffer
      }

      // Update attrib data type from buffer
      // It will be either re-used from val.type or attrib.type
      // or guessed from the typed array
      attrib.type = val.type || attrib.buffer.type

      if (val.offset !== undefined) {
        attrib.offset = val.offset
      }
      if (val.stride !== undefined) {
        attrib.stride = val.stride
      }
      if (val.divisor !== undefined) {
        attrib.divisor = val.divisor
      }

      if (!attrib.type) {
        throw new Error(`Unknown ${attribName} attrib type`)
      }
    }
  }

  for (let prop in opts) {
    if (IndicesMap[prop]) {
      // TODO: this is just a guestimate, we should probably push creating flat uint32 array to the user space
      // const numPositions = this._attributes['aPosition'].count
      const val = opts[prop]
      let indices = this._indices

      if (!indices) {
        indices = this._indices = {
          buffer: null,
          offset: 0,
          type: undefined
        }
      }
      const data = val.length !== undefined ? val : val.data
      if (data) {
        if (!indices.buffer) {
          indices.buffer = ctx.indexBuffer({
            data: data,
            type: val.type || indices.type
          })
        } else {
          ctx.update(indices.buffer, {
            data: data,
            type: val.type || indices.type
          })
        }
      } else if (val.buffer) {
        // TODO: should we delete previous buffer?
        indices.buffer = val.buffer
      }
      if (val.offset !== undefined) {
        indices.offset = val.offset
      }
      if (val.count !== undefined) {
        indices.count = val.count
      }

      indices.type = val.type || indices.buffer.type

      if (!indices.type) {
        throw new Error(`Unknown indices type`)
      }
    }

    this.changed.dispatch(prop)
  }
}

module.exports = function(opts) {
  return new Geometry(opts)
}
