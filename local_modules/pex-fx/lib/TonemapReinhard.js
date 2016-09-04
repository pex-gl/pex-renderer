var FXStage = require('./FXStage');
var fs = require('fs');

var TonemapReinhardGLSL = fs.readFileSync(__dirname + '/TonemapReinhard.glsl', 'utf8');

FXStage.prototype.tonemapReinhard = function (options) {
  options = options || {
    exposure: 1
  };
  var outputSize = this.getOutputSize(options.width, options.height);
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  rt.bind();
  this.getSourceTexture().bind(0);
  var program = this.getShader(TonemapReinhardGLSL);
  program.use();
  program.uniforms.tex0(0);
  program.uniforms.exposure(options.exposure);
  this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);

  rt.unbind();
  return this.asFXStage(rt, 'tonemapReinhard');
};

module.exports = FXStage;