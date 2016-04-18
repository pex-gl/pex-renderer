var renderToCubemap = require('./local_modules/pex-render-to-cubemap');
var downsampleCubemap = require('./local_modules/pex-downsample-cubemap');
var convolveCubemap = require('./local_modules/pex-convolve-cubemap');

//Mipmap levels
//
// 0 - 256
// 1 - 128
// 2 - 64
// 3 - 32
// 4 - 16
// 5 - 8

function ReflectionProbe(ctx, position) {
    this._ctx = ctx;

    this._reflectionMap = ctx.createTextureCube(null, 128, 128, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT });
    this._reflectionMap64 = ctx.createTextureCube(null, 64, 64, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT });
    this._reflectionMap32 = ctx.createTextureCube(null, 32, 32, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT });
    this._reflectionMap16 = ctx.createTextureCube(null, 16, 16, { minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, type: ctx.HALF_FLOAT });
    this._irradianceMap = ctx.createTextureCube(null, 16, 16, { type: ctx.HALF_FLOAT });
}

ReflectionProbe.prototype.update = function(drawScene) {
    var ctx = this._ctx;
        console.log("update reflection");

    renderToCubemap(ctx, this._reflectionMap, drawScene);
    downsampleCubemap(ctx, this._reflectionMap, this._reflectionMap64);
    downsampleCubemap(ctx, this._reflectionMap64, this._reflectionMap32);
    downsampleCubemap(ctx, this._reflectionMap32, this._reflectionMap16);
    convolveCubemap(ctx, this._reflectionMap16, this._irradianceMap);
}

ReflectionProbe.prototype.getReflectionMap = function() {
    return this._reflectionMap;
}

ReflectionProbe.prototype.getIrradianceMap = function() {
    return this._irradianceMap;
}

module.exports = ReflectionProbe;
