var Texture2D = require('pex-context/Texture2D')
var glslify = require('glslify-sync')
var createQuad = require('primitive-quad')
var createMeshFromGeom = require('./local_modules/mesh-from-geom')
var SKYENVMAP_VERT = glslify(__dirname + '/glsl/SkyEnvMap.vert')
var SKYENVMAP_FRAG = glslify(__dirname + '/glsl/SkyEnvMap.frag')

function SkyEnvMap (cmdQueue, sunPosition) {
  this._cmdQueue = cmdQueue
  var ctx = cmdQueue.getContext()

  Texture2D.call(this, ctx, null, 512, 256, { type: ctx.FLOAT })

  this._fsqMesh = createMeshFromGeom(ctx, createQuad())
  this._program = ctx.createProgram(SKYENVMAP_VERT, SKYENVMAP_FRAG)
  this._fbo = ctx.createFramebuffer([{ texture: this }])

  this._clearCommand = cmdQueue.createDrawCommand({
    framebuffer: this._fbo,
    color: [0, 0, 0, 0]
  })

  this._drawCommand = cmdQueue.createDrawCommand({
    framebuffer: this._fbo,
    viewport: [0, 0, this.getWidth(), this.getHeight()],
    program: this._program,
    mesh: this._fsqMesh,
    uniforms: {
      uSunPosition: [0, 0, 0]
    }
  })

  this.setSunPosition(sunPosition)
}

SkyEnvMap.prototype = Object.create(Texture2D.prototype)

SkyEnvMap.prototype.setSunPosition = function (sunPosition) {
  var cmdQueue = this._cmdQueue

  cmdQueue.submit(this._clearCommand)
  cmdQueue.submit(this._drawCommand, {
    uniforms: {
      uSunPosition: sunPosition
    }
  })

}

module.exports = SkyEnvMap
