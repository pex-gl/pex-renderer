var FXStage = require('./FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
var FRAG = fs.readFileSync(__dirname + '/Mult.frag', 'utf8');

FXStage.prototype.mult = function (source2, options) {
    var ctx = this.ctx;
    options = options || {};
    scale = options.scale !== undefined ? options.scale : 1;
    var outputSize = this.getOutputSize(options.width, options.height);
    var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);

    var program = this.getShader(VERT, FRAG);

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);
        ctx.bindFramebuffer(rt);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        ctx.bindTexture(this.getSourceTexture(), 0)
        ctx.bindTexture(this.getSourceTexture(source2), 1)

        ctx.bindProgram(program);
        program.setUniform('tex0', 0);
        program.setUniform('tex1', 1);

        this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

    return this.asFXStage(rt, 'mult');
};

module.exports = FXStage;
