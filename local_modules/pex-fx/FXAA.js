var FXStage = require('./FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/FXAA.vert', 'utf8');
var FRAG = fs.readFileSync(__dirname + '/FXAA.frag', 'utf8');

FXStage.prototype.fxaa = function (options) {
  var ctx = this.ctx;
  options = options || {};
  var outputSize = this.getOutputSize(options.width, options.height);
  var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
  var program = this.getShader(VERT, FRAG);

  ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);
      ctx.bindFramebuffer(rt);
      ctx.setClearColor(0,0,0,0);
      ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

      var source = this.getSourceTexture();

      ctx.bindTexture(source, 0)

      ctx.bindProgram(program);
      program.setUniform('tex0', 0);
      program.setUniform('rtWidth', source.getWidth());
      program.setUniform('rtHeight', source.getHeight());

      this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
  ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

  return this.asFXStage(rt, 'fxaa');
};

module.exports = FXStage;


module.exports = FXStage;
