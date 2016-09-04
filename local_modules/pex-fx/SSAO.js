var FXStage = require('./FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
var FRAG = fs.readFileSync(__dirname + '/SSAO.frag', 'utf8');

FXStage.prototype.ssao = function (options) {
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

        ctx.bindTexture(this.getSourceTexture(options.depthMap), 0)

        ctx.bindProgram(program);
        program.setUniform('textureSize', [outputSize.width, outputSize.height]);
        program.setUniform('depthMap', 0);
        program.setUniform('strength', options.strength || 1);
        program.setUniform('offset', options.offset || 0);
        program.setUniform('near', options.camera.getNear());
        program.setUniform('far', options.camera.getFar());

        this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

    return this.asFXStage(rt, 'mult');
};

module.exports = FXStage;
