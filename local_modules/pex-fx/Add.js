//Adds another texture to current fx stage

//## Example use
//     var fx = require('pex-fx');
//
//     var color = fx(ctx).render({ drawFunc: this.draw.bind(this) });
//     var glow = color.downsample().blur3().blur3();
//     var final = color.add(glow, { scale: 2 });
//     final.blit();
//

//## Reference

//Dependencies
var FXStage = require('./FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
var FRAG = fs.readFileSync(__dirname + '/Add.frag', 'utf8');

//### Add(source2, options)
//Adds another texture to current fx stage
//`source2` - a texture source to add *{ Texture2D or RenderTarget or FXStage }*
//`options` - available options:
// - `scale` - amount of source2 texture to add  *{ Number 0..1 }*

FXStage.prototype.add = function (source2, options) {
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
        program.setUniform('scale', scale);

        this.drawFullScreenQuad(outputSize.width, outputSize.height, null, program);
    ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);

    return this.asFXStage(rt, 'add');
};

module.exports = FXStage;
