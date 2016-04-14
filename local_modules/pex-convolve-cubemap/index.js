var renderToCubemap = require('../pex-render-to-cubemap');
var glslifySync = require('glslify-sync');
var hammersley = require('hammersley');

var VERT = glslifySync(__dirname + '/glsl/convolve.vert');
var FRAG = glslifySync(__dirname + '/glsl/convolve.frag');

var quadPositions = [[-1,-1],[1,-1], [1,1],[-1,1]];
var quadFaces = [ [0, 1, 2], [0, 2, 3]];

var quadMesh = null;
var hammersleyPointSet = 0;
var convolveProgram = null;

function convolveCubemap(ctx, fromCubemap, toCubemap) {
    ctx.pushState(ctx.MESH_BIT | ctx.PROGRAM_BIT); //ctx.TEXTURE_BIT
    if (!quadMesh) {
        var quadAttributes = [ { data: quadPositions, location: ctx.ATTRIB_POSITION } ];
        var quadIndices = { data: quadFaces };
        quadMesh = ctx.createMesh(quadAttributes, quadIndices);

        convolveProgram = ctx.createProgram(VERT, FRAG);

        var numSamples = 512;
        var hammersleyPointSet = new Float32Array(4 * numSamples);
        for(var i=0; i<numSamples; i++) {
            var p = hammersley(i, numSamples)
            hammersleyPointSet[i*4]   = p[0];
            hammersleyPointSet[i*4+1] = p[1];
            hammersleyPointSet[i*4+2] = 0;
            hammersleyPointSet[i*4+3] = 0;
        }

        hammersleyPointSetMap = ctx.createTexture2D(hammersleyPointSet, 1, numSamples, { type: ctx.FLOAT, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST });
    }
    renderToCubemap(ctx, toCubemap, function() {
        ctx.bindTexture(fromCubemap, 0);
        ctx.bindTexture(hammersleyPointSetMap, 1);
        ctx.bindProgram(convolveProgram);
        convolveProgram.setUniform('uEnvMap', 0);
        convolveProgram.setUniform('uHammersleyPointSetMap', 1);
        ctx.bindMesh(quadMesh);
        ctx.drawMesh();
    });
    ctx.popState(ctx.MESH_BIT | ctx.PROGRAM_BIT); //ctx.TEXTURE_BIT
}

module.exports = convolveCubemap;
