var FXStage = require('./local_modules/pex-fx/FXStage')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/SSAO.frag', 'utf8')

FXStage.prototype.ssao = function (options) {
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
      // TODO: move those params to regl.prop()
      uniforms: {
        textureSize: [outputSize.width, outputSize.height],
        depthMap: this.getSourceTexture(options.depthMap),
        normalMap: this.getSourceTexture(options.normalMap),
        kernelMap: options.kernelMap,
        noiseMap: options.noiseMap,
        // program.setUniform('strength', options.strength || 1)
        // program.setUniform('offset', options.offset || 0),
        near: options.camera.getNear(),
        far: options.camera.getFar(),
        fov: options.camera.getFov(),
        aspectRatio: options.camera.getAspectRatio(),
        radius: options.radius || 0.2,
        uProjectionMatrix: options.camera.getProjectionMatrix()
      }
    })
  }

  this.cmd({
  })

  return this.asFXStage(rt, 'ssao')
}

FXStage.prototype.ssao.updateFrag = function (src) {
  FRAG = src
}

module.exports = FXStage
