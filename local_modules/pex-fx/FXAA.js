var FXStage = require('./FXStage')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/FXAA.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/FXAA.frag', 'utf8')

FXStage.prototype.fxaa = function (options) {
  var regl = this.regl
  options = options || {}
  var outputSize = this.getOutputSize(options.width, options.height)
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp)

  var source = this.getSourceTexture()

  var cmd = this.getCommand(VERT, FRAG)
  if (!cmd) {
    // TODO: what if the viewport size / target output has changed?
    // FIXME: i don't know how to pass my uniform to drawFullScreenQuad command,
    // so i'm just doing all of it here
    // how can i inject new uniforms if i don't know their name in the
    // drawFullScreenQuad function, can cmd(props) take props.uniforms somehow?
    cmd = this.addCommand(VERT, FRAG, regl({
      attributes: this.fullscreenQuad.attributes,
      elements: this.fullscreenQuad.elements,
      framebuffer: rt,
      viewport: { x: 0, y: 0, width: outputSize.width, height: outputSize.height },
      vert: VERT,
      frag: FRAG,
      uniforms: {
        tex0: regl.prop('tex0'),
        rtWidth: regl.prop('rtWidth'),
        rtHeight: regl.prop('rtHeight'),
        uOffset: [0, 0],
        uSize: [1, 1]
      }
    }))
  }

  cmd({
    tex0: source,
    rtWidth: source.width,
    rtHeight: source.height
  })

  return this.asFXStage(rt, 'fxaa')
}

module.exports = FXStage
