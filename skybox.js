const createQuad = require('primitive-quad')

const SKYBOX_VERT = require('./glsl/Skybox.vert.js')
const SKYBOX_FRAG = require('./glsl/Skybox.frag.js')

const SKYTEXTURE_VERT = require('./glsl/SkyEnvMap.vert.js')
const SKYTEXTURE_FRAG = require('./glsl/SkyEnvMap.frag.js')

const Signal = require('signals')

function Skybox (opts) {
  this.type = 'Skybox'
  this.changed = new Signal()
  this.rgbm = false

  const ctx = this._ctx = opts.ctx

  this.texture = null
  this.diffuseTexture = null
  this._dirtySunPosition = true

  this.set(opts)

  const skyboxPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const skyboxFaces = [[0, 1, 2], [0, 2, 3]]

  this._drawCommand = {
    name: 'Skybox.draw',
    pipeline: ctx.pipeline({
      vert: SKYBOX_VERT,
      frag: SKYBOX_FRAG,
      depthTest: true
    }),
    attributes: {
      aPosition: ctx.vertexBuffer(skyboxPositions)
    },
    indices: ctx.indexBuffer(skyboxFaces)
  }

  var quad = createQuad()

  this._skyTexture = ctx.texture2D({
    width: 512,
    height: 256,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA32F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear
  })

  this._updateSkyTexture = {
    name: 'Skybox.updateSkyTexture',
    pass: ctx.pass({
      name: 'Skybox.updateSkyTexture',
      color: [ this._skyTexture ],
      clearColor: [0, 0, 0, 0]
    }),
    pipeline: ctx.pipeline({
      vert: SKYTEXTURE_VERT,
      frag: SKYTEXTURE_FRAG
    }),
    uniforms: {
      uSunPosition: [0, 0, 0]
    },
    attributes: {
      aPosition: ctx.vertexBuffer(quad.positions),
      aTexCoord0: ctx.vertexBuffer(quad.uvs)
    },
    indices: ctx.indexBuffer(quad.cells)
  }
}

Skybox.prototype.init = function (entity) {
  this.entity = entity
}

Skybox.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.sunPosition) {
    this._dirtySunPosition = true
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Skybox.prototype.draw = function (camera, opts) {
  var ctx = this._ctx

  if (!this.texture && this._dirtySunPosition) {
    this._dirtySunPosition = false
    ctx.submit(this._updateSkyTexture, {
      uniforms: {
        uSunPosition: this.sunPosition
      }
    })
  }

  let texture = this.texture || this._skyTexture
  if (opts.diffuse && this.diffuseTexture) {
    texture = this.diffuseTexture
  }
  // TODO: can we somehow avoid creating an object every frame here?
  ctx.submit(this._drawCommand, {
    uniforms: {
      uProjectionMatrix: camera.projectionMatrix,
      uViewMatrix: camera.viewMatrix,
      uEnvMap: texture,
      uEnvMapEncoding: texture.encoding,
      uOutputEncoding: opts.outputEncoding
    }
  })
}

module.exports = function createSkybox (opts) {
  if (!opts.sunPosition && !opts.texture) {
    throw new Error('Skybox requires either a sunPosition or a texture')
  }
  return new Skybox(opts)
}
