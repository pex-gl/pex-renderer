var FXStage = require('./FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
var FRAG_H = fs.readFileSync(__dirname + '/Blur5H.frag', 'utf8');
var FRAG_V = fs.readFileSync(__dirname + '/Blur5V.frag', 'utf8');


FXStage.prototype.blur5 = function (options) {
    options = options || {};
    var outputSize = this.getOutputSize(options.width, options.height);
    var rth = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
    var rtv = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
    var source = this.getSourceTexture();
    var programH = this.getShader(VERT, FRAG_H);
    var programV = this.getShader(VERT, FRAG_V);

    var ctx = this.ctx;

    ctx.pushState(ctx.PROGRAM_BIT | ctx.FRAMEBUFFER_BIT);
        ctx.bindFramebuffer(rth);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        this.drawFullScreenQuad(outputSize.width, outputSize.height, source, programH);

        ctx.bindFramebuffer(rtv);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        this.drawFullScreenQuad(outputSize.width, outputSize.height, rth.getColorAttachment(0).texture, programV);
    ctx.popState(ctx.PROGRAM_BIT | ctx.FRAMEBUFFER_BIT);

    return this.asFXStage(rtv, 'blur5');
};

module.exports = FXStage;
