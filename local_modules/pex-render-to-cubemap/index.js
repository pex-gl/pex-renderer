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

var fbo = null
var projectionMatrix = null
var viewMatrix = null

function renderToCubemap (cmdQueue, cubemap, drawScene, level) {
  var ctx = cmdQueue.getContext()

  level = level || 0
  if (!fbo) {
    fbo = ctx.createFramebuffer()
    fbo.id = 'render-to-cubemap'
    projectionMatrix = Mat4.perspective(Mat4.create(), 90, 1, 0.001, 50.0)
    viewMatrix = Mat4.create()
  }

  var levelScale = 1.0 / Math.pow(2.0, level)

  sides.forEach(function (side, sideIndex) {
    Mat4.lookAt(viewMatrix, side.eye, side.target, side.up)

    // TODO: color attacments are ugly
    // TODO: missing depth map, ok-ish because we only render sky
    // TODO: missing depth map clear
    var clearCommand = cmdQueue.createClearCommand({
      framebuffer: fbo,
      framebufferColorAttachments: {
        '0': { target: ctx.TEXTURE_CUBE_MAP_POSITIVE_X + sideIndex, handle: cubemap.getHandle(), level: level }
      },
      color: [sideIndex%3/3, (sideIndex+1)%3/3, 0, 1]
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
}

module.exports = renderToCubemap
