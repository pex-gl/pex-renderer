var FXStage = require('pex-fx/FXStage');
var fs = require('fs');

var VERT = fs.readFileSync(__dirname + '/ScreenImage.vert', 'utf8');
var FRAG = fs.readFileSync(__dirname + '/BilateralBlur.frag', 'utf8');


FXStage.prototype.bilateralBlur = function (options) {
    options = options || {};
    var outputSize = this.getOutputSize(options.width, options.height);
    var readRT = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
    var writeRT = this.getRenderTarget(outputSize.width, outputSize.height, options.depth, options.bpp);
    var source = this.getSourceTexture();
    var depthMap = this.getSourceTexture(options.depthMap);
    var program = this.getShader(VERT, FRAG);

    var ctx = this.ctx;


    var iterations = options.iterations || 1;
    var sharpness = typeof(options.sharpness) === 'undefined' ? 1 : options.sharpness;
    var strength = typeof(options.strength) === 'undefined' ? 0.5 : options.strength;

    ctx.pushState(ctx.PROGRAM_BIT | ctx.FRAMEBUFFER_BIT);
    ctx.bindProgram(program);
    ctx.bindTexture(this.getSourceTexture(options.depthMap), 1)
    program.setUniform('image', 0)
    program.setUniform('imageSize', [ source.getWidth(), source.getHeight() ])
    program.setUniform('depthMap', 1)
    program.setUniform('depthMapSize', [depthMap.getWidth(), depthMap.getHeight()])
    program.setUniform('near', options.camera.getNear());
    program.setUniform('far', options.camera.getFar());
    program.setUniform('sharpness', sharpness);
    for(var i=0; i<iterations * 2; i++) {
        var radius = (iterations - Math.floor(i / 2)) * strength;
        var direction = i % 2 === 0 ? [radius, 0] : [0, radius];

        var src = (i == 0) ? source : readRT.getColorAttachment(0).texture;
        ctx.bindTexture(src, 0);

        ctx.bindFramebuffer(writeRT);
        ctx.setClearColor(0,0,0,1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        program.setUniform('direction', direction)
        this.drawFullScreenQuad(outputSize.width, outputSize.height, src, program);

        var tmp = writeRT;
        writeRT = readRT;
        readRT = tmp;
    }
    ctx.popState(ctx.PROGRAM_BIT | ctx.FRAMEBUFFER_BIT);

    return this.asFXStage(readRT, 'blur');
};

module.exports = FXStage;
