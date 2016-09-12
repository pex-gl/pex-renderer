var Mat4 = require('pex-math/Mat4')

// Flipping up by -1 inspired by http://www.mbroecker.com/project_dynamic_cubemaps.html
var sides = [
  { eye: [0, 0, 0], target: [ 1, 0, 0], up: [0, -1, 0] },
  { eye: [0, 0, 0], target: [-1, 0, 0], up: [0, -1, 0] },
  { eye: [0, 0, 0], target: [0, 1, 0], up: [0, 0, 1] },
  { eye: [0, 0, 0], target: [0, -1, 0], up: [0, 0, -1] },
  { eye: [0, 0, 0], target: [0, 0, 1], up: [0, -1, 0] },
  { eye: [0, 0, 0], target: [0, 0, -1], up: [0, -1, 0] }
]

var drawCubeFace = null
var cubeFbo = null
var projectionMatrix = null
var viewMatrix = null

function renderToCubemap (regl, cubemap, drawScene/*, level*/) {
  // level = level || 0

  if (!drawCubeFace) {
    projectionMatrix = Mat4.perspective(Mat4.create(), 90, 1, 0.001, 50.0)
    viewMatrix = Mat4.create()

    cubeFbo = regl.framebufferCube({
      radius: cubemap.width,
      color: cubemap,
      depth: false,
      stencil: false
    })

    drawCubeFace = regl({
      framebuffer: function (context, props, batchId) {
        return cubeFbo.faces[batchId]
      },
      context: {
        projectionMatrix: projectionMatrix,
        viewMatrix: function (context, props, batchId) {
          var side = sides[batchId]
          Mat4.lookAt(viewMatrix, side.eye, side.target, side.up)
          return viewMatrix
        }
      }
    })
  }
  // TODO: add level
  // var levelScale = 1.0 / Math.pow(2.0, level)
  cubeFbo({
    radius: cubemap.width,
    color: cubemap,
    depth: false,
    stencil: false
  })

  // drawCubeFace.call({ cubemap: cubemap }, 6, drawScene)
  drawCubeFace(6, drawScene)
  /*
  sides.forEach(function (side, sideIndex) {

    // TODO: color attacments are ugly
    // TODO: missing depth map, ok-ish because we only render sky
    // TODO: missing depth map clear
    var clearCommand = cmdQueue.createClearCommand({
      framebuffer: fbo,
      framebufferColorAttachments: {
        '0': { target: ctx.TEXTURE_CUBE_MAP_POSITIVE_X + sideIndex, handle: cubemap.getHandle(), level: level }
      },
      color: [sideIndex % 3 / 3, (sideIndex + 1) % 3 / 3, 0, 1]
    })
    // TODO: should matrices be in uniforms?
    var drawCommand = cmdQueue.createDrawCommand({
      framebuffer: fbo,
      framebufferColorAttachments: {
        '0': { target: ctx.TEXTURE_CUBE_MAP_POSITIVE_X + sideIndex, handle: cubemap.getHandle(), level: level }
      },
      viewport: [0, 0, cubemap.getWidth() * levelScale, cubemap.getHeight() * levelScale],
      projectionMatrix: projectionMatrix,
      viewMatrix: viewMatrix
    })

    cmdQueue.submit(clearCommand)
    cmdQueue.submit(drawCommand, null, drawScene)
  })
  */
}

module.exports = renderToCubemap
