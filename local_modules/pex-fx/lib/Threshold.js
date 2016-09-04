var geom  = require('pex-geom');
var color  = require('pex-color');
var Vec2 = geom.Vec2;
var Color = color.Color;

var FXStage = require('./FXStage');
var fs = require('fs');

var ThresholdGLSL = fs.readFileSync(__dirname + '/Threshold.glsl', 'utf8');

FXStage.prototype.threshold = function (options) {
  options = options || {};
  var threshold = (typeof(options.threshold) != 'undefined') ? options.threshold : 1;
  var color = (typeof(options.color) != 'undefined') ? options.color : Color.White;
  var outputSize = this.getOutputSize(options.width, options.height);
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  var source = this.getSourceTexture();
  source.bind(0);
  var program = this.getShader(ThresholdGLSL);
  program.use();
  program.uniforms.threshold(threshold);
  program.uniforms.tintColor(color);
  rt.bindAndClear();
  this.drawFullScreenQuad(outputSize.width, outputSize.height, source, program);
  rt.unbind();
  return this.asFXStage(rt, 'threshold');
};

module.exports = FXStage;