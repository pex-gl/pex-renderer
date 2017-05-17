const Signal = require('signals')
const glsl = require('glslify')
const random = require('pex-random')
const Vec3 = require('pex-math/Vec3')
const MathUtils = require('pex-math/Utils')
const flatten = require('flatten')

const OVERLAY_VERT = glsl(__dirname + '/glsl/Overlay.vert')
const OVERLAY_FRAG = glsl(__dirname + '/glsl/Overlay.frag')
const SAO_FRAG = glsl(__dirname + '/glsl/SAO.frag')
const BILATERAL_BLUR_FRAG = glsl(__dirname + '/glsl/BilateralBlur.frag')

var ssaoKernel = []
for (let i = 0; i < 64; i++) {
  var sample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    random.float(),
    1
  ]
  Vec3.normalize(sample)
  var scale = random.float()
  scale = MathUtils.lerp(0.1, 1.0, scale * scale)
  Vec3.scale(sample, scale)
  ssaoKernel.push(sample)
}
var ssaoKernelData = new Float32Array(flatten(ssaoKernel))

var ssaoNoise = []
for (let j = 0; j < 64; j++) {
  let noiseSample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    0,
    1
  ]
  ssaoNoise.push(noiseSample)
}
var ssaoNoiseData = new Float32Array(flatten(ssaoNoise))

var ssaoNoiseHiRes = []
for (let j = 0; j < 128 * 128; j++) {
  let noiseSample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    0,
    1
  ]
  ssaoNoiseHiRes.push(noiseSample)
}

var ssaoNoiseDataHiRes = new Float32Array(flatten(ssaoNoiseHiRes))

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

  this._frameAOTex = ctx.texture2D({ width: W, height: H })
  this._frameAOBlurTex = ctx.texture2D({ width: W, height: H })

  ctx.gl.getExtension('OES_texture_float ')
  this._ssaoKernelMap = ctx.texture2D({ width: 8, height: 8, data: ssaoKernelData, format: ctx.PixelFormat.RGBA32F, wrap: ctx.Wrap.Repeat })
  this._ssaoNoiseMap = ctx.texture2D({ width: 128, height: 128, data: ssaoNoiseDataHiRes, format: ctx.PixelFormat.RGBA32F, wrap: ctx.Wrap.Repeat, mag: ctx.Filter.Linear, min: ctx.Filter.Linear })

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

  this._saoCmd = {
    name: 'sao',
    pass: ctx.pass({
      color: [ this._frameAOTex ],
      clearColor: [1, 1, 0, 1]
      // clearDepth: 1
    }),
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: SAO_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      viewportResolution: [W, H],
      sGBuffer: this._frameDepthTex,
      sNoise: this._ssaoNoiseMap
    }
  }

  this._bilateralBlurHCmd = {
    name: 'bilateralBlurH',
    pass: ctx.pass({
      color: [ this._frameAOBlurTex ],
      clearColor: [1, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
      depthMapSize: [W, H],
      image: this._frameAOTex,
      // direction: [State.bilateralBlurRadius, 0], // TODO:
      direction: [0.5, 0],
      uDOFDepth: 0,
      uDOFRange: 0
    }
  }

  this._bilateralBlurVCmd = {
    name: 'bilateralBlurV',
    pass: ctx.pass({
      color: [ this._frameAOTex ],
      clearColor: [1, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
      depthMapSize: [W, H],
      image: this._frameAOBlurTex,
      // direction: [0, State.bilateralBlurRadius], // TODO:
      direction: [0, 0.5],
      uDOFDepth: 0,
      uDOFRange: 0
    }
  }

  this._dofBlurHCmd = {
    name: 'bilateralBlurH',
    pass: ctx.pass({
      color: [ this._frameAOBlurTex ],
      clearColor: [1, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
      depthMapSize: [W, H],
      image: this._frameColorTex,
      // direction: [State.bilateralBlurRadius, 0] // TODO:
      direction: [0.5, 0]
    }
  }

  this._dofBlurVCmd = {
    name: 'bilateralBlurV',
    pass: ctx.pass({
      color: [ this._frameColorTex ],
      clearColor: [1, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
      depthMapSize: [W, H],
      image: this._frameAOBlurTex,
      // direction: [0, State.bilateralBlurRadius] // TODO:
      direction: [0, 0.5]
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
