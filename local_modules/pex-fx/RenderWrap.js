var FXStage = require('./FXStage');

FXStage.prototype.beginRender = function (options) {
    options = options || {};
    var outputSize = this.getOutputSize(options.width, options.height);
    var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);

    var ctx = this.ctx;

    ctx.pushState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT);
        ctx.setViewport(0, 0, outputSize.width, outputSize.height);
        ctx.bindFramebuffer(rt);
        ctx.setClearColor(0,0,0,0);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);

    return this.asFXStage(rt, 'render');
};

FXStage.prototype.endRender = function () {
    var ctx = this.ctx;
    ctx.popState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT);
}

module.exports = FXStage;
