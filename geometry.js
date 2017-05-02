const Signal = require('signals')

function Geometry (opts) {
  this.type = 'Geometry'
  this.changed = new Signal()

  this._attributes = { }

  this.set(opts)
}

Geometry.prototype.init = function (entity) {
  this.entity = entity
}

Geometry.prototype.set = function (opts) {
  const ctx = opts.ctx || this.ctx

  Object.assign(this, opts)
  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))

  if (opts.positions) {
    if (!this._positionsBuf) {
      this._positionsBuf = ctx.vertexBuffer(opts.positions)
    } else {
      ctx.update(this._positionsBuf, { data: opts.positions })
    }
    this._attributes.aPosition = this._positionsBuf
  }

  if (opts.normals) {
    if (!this._normalsBuf) {
      this._normalsBuf = ctx.vertexBuffer(opts.normals)
    } else {
      ctx.update(this._normalsBuf, { data: opts.normals })
    }
    this._attributes.aNormal = this._normalsBuf
  }

  if (opts.texCoords || opts.uvs) {
    if (!this._texCoordsBuf) {
      this._texCoordsBuf = ctx.vertexBuffer(opts.texCoords || opts.uvs)
    } else {
      ctx.update(this._texCoordsBuf, { data: opts.texCoords || opts.uvs })
    }
    this._attributes.aTexCoord0 = this._texCoordsBuf
  }

  if (opts.offsets) {
    if (!this._offsetsBuf) {
      this._offsetsBuf = ctx.vertexBuffer(opts.offsets)
    } else {
      ctx.update(this._offsetsBuf, { data: opts.offsets })
    }
    this._attributes.aOffset = this._offsetsBuf
  }

  if (opts.scales) {
    if (!this._scalesBuf) {
      this._scalesBuf = ctx.vertexBuffer(opts.scales)
    } else {
      ctx.update(this._scalesBuf, { data: opts.scales })
    }
    this._attributes.aScale = this._scalesBuf
  }

  if (opts.rotations) {
    if (!this._rotationsBuf) {
      this._rotationsBuf = ctx.vertexBuffer(opts.rotations)
    } else {
      ctx.update(this._rotationsBuf, { data: opts.rotations })
    }
    this._attributes.aRotation = this._rotationsBuf
  }

  if (opts.colors) {
    if (!this._colorsBuf) {
      this._colorsBuf = ctx.vertexBuffer(opts.colors)
    } else {
      ctx.update(this._colorsBuf, { data: opts.colors })
    }
    this._attributes.aColor = this._colorsBuf
  }

  if (opts.indices || opts.cells) {
    if (!this.indicesBuf) {
      this._indicesBuf = ctx.indexBuffer(opts.indices || opts.cells)
    } else {
      ctx.update(this._indicesBuf, { data: opts.indices || opts.cells })
    }
    this._indices = this._indicesBuf
  }
}

module.exports = function (opts) {
  return new Geometry(opts)
}
