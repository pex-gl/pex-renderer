var FXStage = require('./local_modules/pex-fx/FXStage')
var fs = require('fs')

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8')
var FRAG = fs.readFileSync(__dirname + '/BilateralBlur.frag', 'utf8')

FXStage.prototype.bilateralBlur = function (options) {
  var regl = this.regl
  options = options || {}
  var outputSize = this.getOutputSize(options.width, options.height)
  var readRT = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp)
  var writeRT = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp)
  var source = this.getSourceTexture()
  var depthMap = this.getSourceTexture(options.depthMap)

  var iterations = options.iterations || 1
  var sharpness = typeof (options.sharpness) === 'undefined' ? 1 : options.sharpness
  var strength = typeof (options.strength) === 'undefined' ? 0.5 : options.strength

  if (!this.cmd) {
    // TODO: what if the viewport size / target output has changed?
    // FIXME: i don't know how to pass my uniform to drawFullScreenQuad command,
    // so i'm just doing all of it here
    // how can i inject new uniforms if i don't know their name in the
    // drawFullScreenQuad function, can cmd(props) take props.uniforms somehow?
    this.cmd = regl({
      attributes: this.fullscreenQuad.attributes,
      elements: this.fullscreenQuad.elements,
      framebuffer: regl.prop('framebuffer'),
      viewport: { x: 0, y: 0, width: outputSize.width, height: outputSize.height },
      vert: VERT,
      frag: FRAG,
      // TODO: move those params to regl.prop()
      uniforms: {
        image: regl.prop('image'),
        imageSize: regl.prop('imageSize'),
        depthMap: regl.prop('depthMap'),
        depthMapSize: regl.prop('depthMapSize'),
        near: regl.prop('near'),
        far: regl.prop('far'),
        sharpness: regl.prop('sharpness'),
        direction: regl.prop('direction')
      }
    })
  }

  for (var i = 0; i < iterations * 2; i++) {
    var radius = (iterations - Math.floor(i / 2)) * strength
    var direction = i % 2 === 0 ? [radius, 0] : [0, radius]
    var src = (i === 0) ? source : readRT.color[0]

    this.cmd({
      framebuffer: writeRT,
      image: src,
      imageSize: [src.width, src.height],
      depthMap: depthMap,
      depthMapSize: [depthMap.width, depthMap.height],
      near: options.camera.getNear(),
      far: options.camera.getFar(),
      sharpness: sharpness,
      direction: direction
    })

    var tmp = writeRT
    writeRT = readRT
    readRT = tmp
  }

  return this.asFXStage(readRT, 'bilateralBlur')
}

module.exports = FXStage
