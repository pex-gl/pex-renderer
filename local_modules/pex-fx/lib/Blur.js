var geom  = require('pex-geom');
var Vec2 = geom.Vec2;
var FXStage = require('./FXStage');
var fs = require('fs');

var BlurHGLSL = fs.readFileSync(__dirname + '/BlurH.glsl', 'utf8');
var BlurVGLSL = fs.readFileSync(__dirname + '/BlurV.glsl', 'utf8');

FXStage.prototype.blur = function (options) {
  options = options || {};
  var amount = (typeof(options.amount) != 'undefined') ? options.amount : 1;
  var outputSize = this.getOutputSize(options.width, options.height);
  var rth = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  var rtv = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  var source = this.getSourceTexture();
  var programH = this.getShader(BlurHGLSL);
  programH.use();
  programH.uniforms.imageSize(Vec2.create(source.width, source.height));
  programH.uniforms.amount(amount);
  rth.bindAndClear();
  this.drawFullScreenQuad(outputSize.width, outputSize.height, source, programH);
  rth.unbind();
  var programV = this.getShader(BlurVGLSL);
  programV.use();
  programV.uniforms.imageSize(Vec2.create(source.width, source.height));
  programV.uniforms.amount(amount);
  rtv.bindAndClear();
  this.drawFullScreenQuad(outputSize.width, outputSize.height, rth.getColorAttachment(0), programV);
  rtv.unbind();
  return this.asFXStage(rtv, 'blur');
};

module.exports = FXStage;