var Mat4 = require('pex-math/Mat4');

//Flipping up by -1 inspired by http://www.mbroecker.com/project_dynamic_cubemaps.html
var sides = [
    { eye: [0, 0, 0], target: [ 1, 0, 0], up: [0, -1, 0], color: [1, 0, 0, 1] },
    { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0], color: [0, 0, 0, 1] },
    { eye: [0, 0, 0], target: [0,  1, 0], up: [0, 0, 1], color: [0, 0, 0, 1] },
    { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1], color: [0, 0, 0, 1] },
    { eye: [0, 0, 0], target: [0, 0,  1], up: [0, -1, 0], color: [0, 0, 0, 1] },
    { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0], color: [0, 0, 0, 1] },
];

var fbo = null;
var projectionMatrix = null;
var viewMatrix = null;

function renderToCubemap(ctx, cubemap, drawScene, level) {
    level = level || 0;
    if (!fbo) {
        fbo = ctx.createFramebuffer();
        projectionMatrix = Mat4.perspective(Mat4.create(), 90, 1, 0.001, 50.0);
        viewMatrix = Mat4.create();
    }

    ctx.pushState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT | ctx.MATRIX_PROJECTION_BIT | ctx.MATRIX_VIEW_BIT | ctx.COLOR_BIT);
    ctx.setViewport(0, 0, cubemap.getWidth(), cubemap.getHeight());
    ctx.bindFramebuffer(fbo);
    ctx.setProjectionMatrix(projectionMatrix);
    sides.forEach(function(side, sideIndex) {
        fbo.setColorAttachment(0, ctx.TEXTURE_CUBE_MAP_POSITIVE_X + sideIndex, cubemap.getHandle(), level);
        ctx.setClearColor(side.color[0], side.color[1], side.color[2], 1);
        //ctx.setClearColor(0, 0, 0, 1);
        ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT);
        Mat4.lookAt(viewMatrix, side.eye, side.target, side.up);
        ctx.setViewMatrix(viewMatrix);
        drawScene();
    })
    ctx.popState(ctx.VIEWPORT_BIT | ctx.FRAMEBUFFER_BIT | ctx.MATRIX_PROJECTION_BIT | ctx.MATRIX_VIEW_BIT | ctx.COLOR_BIT);
}

module.exports = renderToCubemap;
