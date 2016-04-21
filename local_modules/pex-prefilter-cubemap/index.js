var renderToCubemap = require('../pex-render-to-cubemap');
var glslifySync = require('glslify-sync');
var hammersley = require('hammersley');
var isBrowser = require('is-browser');
var VERT = glslifySync(__dirname + '/glsl/prefilter.vert');
var FRAG = glslifySync(__dirname + '/glsl/prefilter.frag');

var quadPositions = [[-1,-1],[1,-1], [1,1],[-1,1]];
var quadFaces = [ [0, 1, 2], [0, 2, 3]];

var quadMesh = null;
var prefilterProgram = null;

function prefilterCubemap(ctx, fromCubemap, toCubemap, options) {
    options = options || {};
    var highQuality = (options.highQuality !== undefined) ? options.highQuality : true;

    if (fromCubemap.getWidth() != toCubemap.getWidth() || fromCubemap.getHeight() != toCubemap.getHeight()) {
        throw new Error('PrefilterCubemap. Source and target cubemap are different size!');
    }

    var numSamples = highQuality ? 1024 : 128;
    var hammersleyPointSet = new Float32Array(4 * numSamples);
    for(var i=0; i<numSamples; i++) {
        var p = hammersley(i, numSamples)
        hammersleyPointSet[i*4]   = p[0];
        hammersleyPointSet[i*4+1] = p[1];
        hammersleyPointSet[i*4+2] = 0;
        hammersleyPointSet[i*4+3] = 0;
    }
    var hammersleyPointSetMap = ctx.createTexture2D(hammersleyPointSet, 1, numSamples, { type: ctx.FLOAT, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST });

    //console.log(ctx.getGL().getError() + ' after hammersley');

    ctx.pushState(ctx.MESH_BIT | ctx.PROGRAM_BIT); //ctx.TEXTURE_BIT
    if (!quadMesh) {
        var quadAttributes = [ { data: quadPositions, location: ctx.ATTRIB_POSITION } ];
        var quadIndices = { data: quadFaces };
        quadMesh = ctx.createMesh(quadAttributes, quadIndices);

        prefilterProgram = ctx.createProgram(VERT, FRAG);
    }
    var numLevels = Math.log(fromCubemap.getWidth())/Math.log(2);
    var size = toCubemap.getWidth();
    toCubemap.levels = [];
    for(var level=0; level<=numLevels; level++) {
        //console.log('prefilter-cubemap level:' + level + ' roughness:' + level/numLevels*0.99 + 0.01 + ' size:' + size)
        var cubemapForLevel = toCubemap;
        cubemapForLevel = ctx.createTextureCube(null, size, size, { type: ctx.UNSIGNED_BYTE, magFilter: ctx.NEAREST, minFilter: ctx.NEAREST });
        toCubemap.levels.push(cubemapForLevel);
        var faceData = [];
        var gl = ctx.getGL();
        //console.log(ctx.getGL().getError() + ' before level ' + level);

        renderToCubemap(ctx, cubemapForLevel, function() {
            ctx.bindTexture(fromCubemap, 0);
            ctx.bindTexture(hammersleyPointSetMap, 1);
            ctx.bindProgram(prefilterProgram);
            prefilterProgram.setUniform('uEnvMap', 0);
            prefilterProgram.setUniform('uHammersleyPointSetMap', 1);
            prefilterProgram.setUniform('uNumSamples', numSamples);
            prefilterProgram.setUniform('uRoughness', Math.min(1.0, level * 0.2));
            ctx.bindMesh(quadMesh);
            ctx.drawMesh();

            var pixels = new Uint8Array(size * size * 4);
            var floatPixels = new Float32Array(size * size * 4);
            //FIXME: our PREM cubemap is basically LDR, we need to compress pixels
            gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            for(var i=0; i<pixels.length; i++) {
                floatPixels[i] = pixels[i] / 255;
            }
            faceData.push(floatPixels);
        }, 0); //always on the top of mipmap cube
        //console.log(ctx.getGL().getError() + ' after level ' + level);

        //updated mip level
        ctx.bindTexture(toCubemap);
        for(var i=0; i<6; i++) {
            if (isBrowser) {
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            }
            gl.texImage2D(ctx.TEXTURE_CUBE_MAP_POSITIVE_X + i, level, ctx.RGBA, size, size, 0, ctx.RGBA, ctx.FLOAT, faceData[i]);
        }

        //console.log(ctx.getGL().getError() + ' after level upload' + level);

        //TODO: dispose cubemap textures

        //gl.generateMipmap(ctx.TEXTURE_CUBE_MAP);
        //gl.texParameterf(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR );

        size /= 2;
    }

    ctx.popState(ctx.MESH_BIT | ctx.PROGRAM_BIT); //ctx.TEXTURE_BIT
}

module.exports = prefilterCubemap;
