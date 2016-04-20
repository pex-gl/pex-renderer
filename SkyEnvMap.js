var Texture2D = require('pex-context/Texture2D');
var glslify            = require('glslify-sync');
var createQuad         = require('primitive-quad');
var createMeshFromGeom = require('./local_modules/mesh-from-geom');
var SKYENVMAP_VERT        = glslify(__dirname + '/glsl/SkyEnvMap.vert');
var SKYENVMAP_FRAG        = glslify(__dirname + '/glsl/SkyEnvMap.frag');

function SkyEnvMap(ctx, sunPosition) {
    Texture2D.call(this, ctx, null, 512, 256, { type: ctx.FLOAT })

    this._fsqMesh = createMeshFromGeom(ctx, createQuad());
    this._program = ctx.createProgram(SKYENVMAP_VERT, SKYENVMAP_FRAG);
    this._fbo = ctx.createFramebuffer([ { texture: this }]);

    this.setSunPosition(sunPosition);
}

SkyEnvMap.prototype = Object.create(Texture2D.prototype);

SkyEnvMap.prototype.setSunPosition = function(sunPosition) {
    var ctx = this._ctx;

    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.PROGRAM_BIT | ctx.VIEWPORT_BIT);
    ctx.bindFramebuffer(this._fbo);
    ctx.setClearColor(0, 0, 0, 0);
    ctx.clear(ctx.COLOR_BIT);
    ctx.setViewport(0, 0, this.getWidth(), this.getHeight());
    ctx.bindProgram(this._program);
    this._program.setUniform('uSunPosition', sunPosition);
    ctx.bindMesh(this._fsqMesh);
    ctx.drawMesh();
    ctx.popState();
}

module.exports = SkyEnvMap;
