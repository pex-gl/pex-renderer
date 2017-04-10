const glsl = require('glslify')
const createQuad = require('primitive-quad')
const SKYENVMAP_VERT = glsl(__dirname + '/glsl/SkyEnvMap.vert')
const SKYENVMAP_FRAG = glsl(__dirname + '/glsl/SkyEnvMap.frag')

function SkyEnvMap (ctx, sunPosition) {
  this._ctx = ctx

  this.texture = ctx.texture2D({ width: 512, height: 256, format: ctx.PixelFormat.RGBA32F })

  var quad = createQuad()
  console.log('quad', quad)

  this._drawCommand = {
    name: 'sky env map',
    pass: ctx.pass({
      color: [ this.texture ],
      clearColor: [0, 0, 0, 0]
    }),
    pipeline: ctx.pipeline({
      vert: SKYENVMAP_VERT,
      frag: SKYENVMAP_FRAG
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

  this.setSunPosition(sunPosition)
}

SkyEnvMap.prototype.setSunPosition = function (sunPosition) {
  var ctx = this._ctx

  ctx.submit(this._drawCommand, {
    uniforms: {
      uSunPosition: sunPosition
    }
  })
}

module.exports = SkyEnvMap
