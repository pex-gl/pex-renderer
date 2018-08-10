var glslifySync = require('glslify-sync');
var VERT = glslifySync(__dirname + '/glsl/CubemapToOctmap.vert');
var FRAG = glslifySync(__dirname + '/glsl/CubemapToOctmap.frag');

var fbo = null
var mesh = null
var program = null

function cubemapToOctmap(ctx, fromCubemap, toOctmap) {
    if (!fbo) {
        fbo = ctx.createFramebuffer()

        var positions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        var uvs = [[0,0], [1,0], [1,1], [0,1]]
        var indices = [[0, 1, 2], [0, 2, 3]]
        mesh = ctx.createMesh([
            { data: positions, location: ctx.ATTRIB_POSITION },
            { data: uvs, location: ctx.ATTRIB_TEX_COORD_0 }
        ], { data: indices }, ctx.TRIANGLES)

        program = ctx.createProgram(VERT, FRAG)
    }
    ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.MESH_BIT | ctx.PROGRAM_BIT | ctx.VIEWPORT_BIT | ctx.TEXTURE_BIT)
    ctx.bindFramebuffer(fbo)
    ctx.bindTexture(fromCubemap, 0)
    ctx.bindMesh(mesh)
    ctx.bindProgram(program)
    program.setUniform('uCubemap', 0)
    program.setUniform('uCubemapFlipEnvMap', fromCubemap.getFlipEnvMap())
    fbo.setColorAttachment(0, toOctmap.getTarget(), toOctmap.getHandle())
    ctx.setViewport(0, 0, toOctmap.getWidth(), toOctmap.getHeight())
    ctx.drawMesh()
    ctx.popState()
}

module.exports = cubemapToOctmap;
