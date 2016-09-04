var FXStage = require('./FXStage');

FXStage.prototype.render = function (options) {
    var outputSize = this.getOutputSize(options.width, options.height);
    var rt = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
    var ctx = this.ctx;
    ctx.pushState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT);
        ctx.setViewport(0, 0, outputSize.width, outputSize.height);
        ctx.bindFramebuffer(rt);
        if (options.drawFunc) {
            options.drawFunc();
        }
    ctx.popState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT);
    return this.asFXStage(rt, 'render');
};
