const glsl = require('glslify')
const createQuad = require('primitive-quad')

const SKYBOX_VERT = glsl(__dirname + '/glsl/Skybox.vert')
const SKYBOX_FRAG = glsl(__dirname + '/glsl/Skybox.frag')

const SKYTEXTURE_VERT = glsl(__dirname + '/glsl/SkyEnvMap.vert')
const SKYTEXTURE_FRAG = glsl(__dirname + '/glsl/SkyEnvMap.frag')

const Signal = require('signals')

function Skybox (opts) {
  this.type = 'Skybox'
  this.changed = new Signal()

  const ctx = this._ctx = opts.ctx

  this.texture = null
  this._dirtySunPosition = true

  this.set(opts)

  const skyboxPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const skyboxFaces = [[0, 1, 2], [0, 2, 3]]

  this._drawCommand = {
    name: 'Skybox.draw',
    pipeline: ctx.pipeline({
      vert: SKYBOX_VERT,
      frag: SKYBOX_FRAG,
      depthEnabled: true
    }),
    attributes: {
      aPosition: ctx.vertexBuffer(skyboxPositions)
    },
    indices: ctx.indexBuffer(skyboxFaces)
  }

  var quad = createQuad()

  this._skyTexture = ctx.texture2D({ width: 512, height: 256 })
  this._updateSkyTexture = {
    name: 'sky env map',
    pass: ctx.pass({
      color: [ this._skyTexture ],
      clearColor: [0, 0, 0, 0]
    }),
    pipeline: ctx.pipeline({
      vert: SKYTEXTURE_VERT,
      frag: SKYTEXTURE_FRAG
    }),
    uniforms: {
      uSunPosition: [0, 0, 0],
      uRGBM: this.rgbm
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

Skybox.prototype.draw = function (camera) {
  var ctx = this._ctx

  if (!this.texture && this._dirtySunPosition) {
    this._dirtySunPosition = false
    ctx.submit(this._updateSkyTexture, {
      uniforms: {
        uSunPosition: this.sunPosition
      }
    })
  }

  // TODO: can we somehow avoid creating an object every frame here?
  ctx.submit(this._drawCommand, {
    uniforms: {
      uProjectionMatrix: camera.projectionMatrix,
      uViewMatrix: camera.viewMatrix,
      uEnvMap: this.texture || this._skyTexture
    }
  })
}

module.exports = function createSkybox (opts) {
  if (!opts.sunPosition && !opts.texture) {
    throw new Error('Skybox requires either a sunPosition or a texture')
  }
  return new Skybox(opts)
}
