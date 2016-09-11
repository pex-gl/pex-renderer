var glslify = require('glslify-sync')
var createQuad = require('primitive-quad')
var SKYENVMAP_VERT = glslify(__dirname + '/glsl/SkyEnvMap.vert')
var SKYENVMAP_FRAG = glslify(__dirname + '/glsl/SkyEnvMap.frag')

function SkyEnvMap (regl, sunPosition) {
  this._regl = regl
  this._texture = regl.texture({
    shape: [512, 256],
    type: 'float'
  })

  var quad = createQuad()

  this._fbo = regl.framebuffer({
    color: this._texture
  })

  this._drawCommand = regl({
    framebuffer: this._fbo,
    viewport: { x: 0, y: 0, width: this._texture.width, height: this._texture.height },
    vert: SKYENVMAP_VERT,
    frag: SKYENVMAP_FRAG,
    attributes: {
      aPosition: quad.positions,
      aTexCoord0: quad.uvs
    },
    elements: quad.cells,
    uniforms: {
      uSunPosition: regl.prop('sunPosition')
    }
  })
  this.setSunPosition(sunPosition)
}

SkyEnvMap.prototype.setSunPosition = function (sunPosition) {
  var regl = this._regl
  this._drawCommand({
    sunPosition: this.sunPosition
  }, function () {
    regl.clear({ color: [0, 0, 0, 0] })
  })
}

module.exports = SkyEnvMap
