var FXStage = require('pex-fx/FXStage');
var glslify = require('glslify-sync');

var VERT = glslify(__dirname + '/ScreenImage.vert');
var FRAG = glslify(__dirname + '/Postprocess.frag');

FXStage.prototype.postprocess = function (options) {
    var ctx = this.ctx;
    options = options || {};
    exposure = options.exposure !== undefined ? options.exposure : 1;
    var outputSize = this.getOutputSize(options.width, options.height);
    var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);

    var program = this.getShader(VERT, FRAG);

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);
        ctx.bindFramebuffer(rt);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

        ctx.bindTexture(this.getSourceTexture(), 0)

        ctx.bindProgram(program);
        program.setUniform('tex0', 0);
        program.setUniform('uExposure', exposure);

        this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

    return this.asFXStage(rt, 'add');
};

module.exports = FXStage;
