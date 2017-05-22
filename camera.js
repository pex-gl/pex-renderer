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
for (let j = 0; j < 128 * 128; j++) {
  let noiseSample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    0,
    1
  ]
  ssaoNoise.push(noiseSample)
}
var ssaoNoiseData = new Float32Array(flatten(ssaoNoise))


function Camera (opts) {
  this.type = 'Camera'
  this.changed = new Signal()
  this.backgroundColor = [0, 0, 0, 1]
  this.rgbm = false
  this.depthPrepass = true
  this.ssao = false
  this.ssaoIntensity = 5
  this.ssaoRadius = 12
  this.ssaoBias = 0.01
  this.dof = false
  this.dofIterations = 1
  this.dofRange = 5
  this.dofRadius = 1
  this.dofDepth = 6.76
  this.bilateralBlur = false
  this.bilateralBlurRadius = 0.5
  this.exposure = 1
  this.fxaa = false

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
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA32F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })

  this._frameDepthTex = ctx.texture2D({
    width: W,
    height: H,
    pixelFormat: ctx.PixelFormat.Depth,
    encoding: ctx.Encoding.Linear
  })

  this._frameAOTex = ctx.texture2D({ width: W, height: H, pixelFormat: ctx.PixelFormat.RGBA8, encoding: ctx.Encoding.Linear })
  this._frameAOBlurTex = ctx.texture2D({ width: W, height: H, pixelFormat: ctx.PixelFormat.RGBA8, encoding: ctx.Encoding.Linear })
  this._frameDofBlurTex = ctx.texture2D({ width: W, height: H, pixelFormat: ctx.PixelFormat.RGBA32F, encoding: ctx.Encoding.Linear })

  ctx.gl.getExtension('OES_texture_float ')
  this._ssaoKernelMap = ctx.texture2D({ width: 8, height: 8, data: ssaoKernelData, pixelFormat: ctx.PixelFormat.RGBA32F, encoding: ctx.Encoding.Linear, wrap: ctx.Wrap.Repeat })
  this._ssaoNoiseMap = ctx.texture2D({ width: 128, height: 128, data: ssaoNoiseData, pixelFormat: ctx.PixelFormat.RGBA32F, encoding: ctx.Encoding.Linear, wrap: ctx.Wrap.Repeat, mag: ctx.Filter.Linear, min: ctx.Filter.Linear })

  this._drawFrameFboCommand = {
    name: 'Camera.drawFrame',
    pass: ctx.pass({
      name: 'Camera.drawFrame',
      // color: [ this._frameColorTex, this._frameNormalTex ],
      color: [ this._frameColorTex ],
      depth: this._frameDepthTex,
      clearColor: this.backgroundColor,
      clearDepth: 1
    })
  }

  // this._overlayProgram = ctx.program({ vert: OVERLAY_VERT, frag: OVERLAY_FRAG }) // TODO
  this._blitCmd = {
    name: 'Camera.blit',
    pipeline: ctx.pipeline({
      vert: OVERLAY_VERT,
      frag: OVERLAY_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      uScreenSize: [W, H],
      uOverlay: this._frameColorTex,
      uOverlayEncoding: this._frameColorTex.encoding
    }
  }

  this._ssaoCmd = {
    name: 'Camera.ssao',
    pass: ctx.pass({
      name: 'Camera.ssao',
      color: [ this._frameAOTex ],
      clearColor: [0, 0, 0, 1]
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
    name: 'Camera.bilateralBlurH',
    pass: ctx.pass({
      name: 'Camera.bilateralBlurH',
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
    name: 'Camera.bilateralBlurV',
    pass: ctx.pass({
      name: 'Camera.bilateralBlurV',
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
    name: 'Camera.bilateralBlurH',
    pass: ctx.pass({
      name: 'Camera.dofBilateralBlurH',
      color: [ this._frameDofBlurTex ],
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
    name: 'Camera.bilateralBlurV',
    pass: ctx.pass({
      name: 'Camera.dofBilateralBlurV',
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
      image: this._frameDofBlurTex,
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
