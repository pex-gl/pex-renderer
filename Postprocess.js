var FXStage = require('./local_modules/pex-fx/FXStage')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/Postprocess.frag', 'utf8')

FXStage.prototype.postprocess = function (options) {
  var regl = this.regl

  options = options || {}
  var exposure = options.exposure !== undefined ? options.exposure : 1
  var source = this.getSourceTexture()
  var outputSize = this.getOutputSize(options.width, options.height)
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp)
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
        image: regl.prop('image'),
        uExposure: regl.prop('exposure')
      }
    }))
  }

  cmd({
    image: source,
    exposure: exposure
  })

  return this.asFXStage(rt, 'Postprocess')
}

module.exports = FXStage
