var FXStage = require('./FXStage')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/Mult.frag', 'utf8')

FXStage.prototype.mult = function (source2, options) {
  var regl = this.regl
  options = options || {}
  var outputSize = this.getOutputSize(options.width, options.height)
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp)

  if (!this.cmd) {
    // TODO: what if the viewport size / target output has changed?
    // FIXME: i don't know how to pass my uniform to drawFullScreenQuad command,
    // so i'm just doing all of it here
    // how can i inject new uniforms if i don't know their name in the
    // drawFullScreenQuad function, can cmd(props) take props.uniforms somehow?
    this.cmd = regl({
      attributes: this.fullscreenQuad.attributes,
      elements: this.fullscreenQuad.elements,
      framebuffer: rt,
      viewport: { x: 0, y: 0, width: outputSize.width, height: outputSize.height },
      vert: VERT,
      frag: FRAG,
      uniforms: {
        tex0: regl.prop('tex0'),
        tex1: regl.prop('tex1'),
        uOffset: [0, 0],
        uSize: [1, 1]
      }
    })
  }

  this.cmd({
    tex0: this.getSourceTexture(),
    tex1: this.getSourceTexture(source2)
  })

  return this.asFXStage(rt, 'mult')
}

module.exports = FXStage
