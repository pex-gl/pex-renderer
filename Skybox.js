var createQuad         = require('primitive-quad');
var createMeshFromGeom = require('./local_modules/mesh-from-geom');
var fs = require('fs');

var SKYBOX_VERT        = fs.readFileSync(__dirname + '/glsl/Skybox.vert', 'utf8');
var SKYBOX_FRAG        = fs.readFileSync(__dirname + '/glsl/Skybox.frag', 'utf8');

function Skybox(ctx, envMap) {
    this._ctx = ctx;
    var skyboxPositions = [[-1,-1],[1,-1], [1,1],[-1,1]];
    var skyboxFaces = [ [0, 1, 2], [0, 2, 3]];
    var skyboxAttributes = [
        { data: skyboxPositions, location: ctx.ATTRIB_POSITION },
    ];
    var skyboxIndices = { data: skyboxFaces };
    this._fsqMesh = ctx.createMesh(skyboxAttributes, skyboxIndices);
    //this._fsqMesh = createMeshFromGeom(ctx, createQuad());

    this._skyboxProgram = ctx.createProgram(SKYBOX_VERT, SKYBOX_FRAG);

    this._envMap = envMap;
}

Skybox.prototype.setEnvMap = function(envMap) {
    this._envMap = envMap;
}

Skybox.prototype.draw = function() {
    var ctx = this._ctx;

    ctx.pushState(ctx.DEPTH_BIT | ctx.TEXTURE_BIT | ctx.PROGRAM_BIT);
    ctx.setDepthTest(false);
    ctx.bindProgram(this._skyboxProgram);

    ctx.bindTexture(this._envMap, 0);
    this._skyboxProgram.setUniform('uEnvMap', 0);

    ctx.bindMesh(this._fsqMesh);
    ctx.drawMesh();
    ctx.popState();
}

module.exports = Skybox;
