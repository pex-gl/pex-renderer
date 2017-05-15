const Signal = require('signals')
const glsl = require('glslify')

const OVERLAY_VERT = glsl(__dirname + '/glsl/Overlay.vert')
const OVERLAY_FRAG = glsl(__dirname + '/glsl/Overlay.frag')

function Camera (opts) {
  this.type = 'Camera'
  this.changed = new Signal()
  this.backgroundColor = [1, 0, 0, 1]
  this.rgbm = true

  this.set(opts)

  this.initPostproces()
}

Camera.prototype.init = function (entity) {
  this.entity = entity
}

Camera.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.camera) {
    const camera = this.camera = opts.camera
    this.projectionMatrix = camera.projectionMatrix
    this.viewMatrix = camera.viewMatrix
    this.position = camera.position
    this.target = this.target
    this.up = camera.up
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Camera.prototype.initPostproces = function () {
  var ctx = this.ctx
  var fsqPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var fsqFaces = [[0, 1, 2], [0, 2, 3]]

  var W = this.viewport ? this.viewport[2] : ctx.gl.drawingBufferWidth
  var H = this.viewport ? this.viewport[3] : ctx.gl.drawingBufferHeight

  this._fsqMesh = {
    attributes: {
      aPosition: ctx.vertexBuffer(fsqPositions)
    },
    indices: ctx.indexBuffer(fsqFaces)
  }

  this._frameColorTex = ctx.texture2D({
    width: W,
    height: H,
    format: this.rgbm ? null : ctx.PixelFormat.RGBA32F
  })
  this._frameDepthTex = ctx.texture2D({ width: W, height: H, format: ctx.PixelFormat.Depth })

  this._drawFrameFboCommand = {
    name: 'drawFrame',
    pass: ctx.pass({
      // color: [ this._frameColorTex, this._frameNormalTex ],
      color: [ this._frameColorTex ],
      depth: this._frameDepthTex,
      clearColor: this.backgroundColor,
      clearDepth: 1
    })
  }

  // this._overlayProgram = ctx.program({ vert: OVERLAY_VERT, frag: OVERLAY_FRAG }) // TODO
  this._blitCmd = {
    name: 'blit',
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: OVERLAY_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      uScreenSize: [W, H],
      uOverlay: this._frameColorTex,
      uRGBM: this.rgbm
    }
  }
}

Camera.prototype.update = function () {
  // TODO: copy position from camera to transform on camera change
  // TODO: copy position from transform to camera on transform change?
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
