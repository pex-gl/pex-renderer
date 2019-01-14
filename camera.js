const Signal = require('signals')
const random = require('pex-random')
const vec3 = require('pex-math/vec3')
const mat4 = require('pex-math/mat4')
const utils = require('pex-math/utils')

const POSTPROCESS_VERT = require('./shaders/post-processing/post-processing.vert.js')
const POSTPROCESS_FRAG = require('./shaders/post-processing/post-processing.frag.js')

const SAO_FRAG = require('./shaders/post-processing/sao.frag.js')
const BILATERAL_BLUR_FRAG = require('./shaders/post-processing/bilateral-blur.frag.js')
const THRESHOLD_FRAG = require('./shaders/post-processing/threshold.frag.js')
const BLOOM_FRAG = require('./shaders/post-processing/bloom.frag.js')

var ssaoKernelData = new Float32Array(64 * 4)
for (let i = 0; i < 64; i++) {
  var sample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    random.float(),
    1
  ]
  vec3.normalize(sample)
  var scale = random.float()
  scale = utils.lerp(0.1, 1.0, scale * scale)
  vec3.scale(sample, scale)
  ssaoKernelData[i * 4 + 0] = sample[0]
  ssaoKernelData[i * 4 + 1] = sample[1]
  ssaoKernelData[i * 4 + 2] = sample[2]
  ssaoKernelData[i * 4 + 3] = sample[3]
}

var ssaoNoiseData = new Float32Array(128 * 128 * 4)
for (let i = 0; i < 128 * 128; i++) {
  let noiseSample = [
    random.float() * 2 - 1,
    random.float() * 2 - 1,
    0,
    1
  ]
  ssaoNoiseData[i * 4 + 0] = sample[0]
  ssaoNoiseData[i * 4 + 1] = sample[1]
  ssaoNoiseData[i * 4 + 2] = sample[2]
  ssaoNoiseData[i * 4 + 3] = sample[3]
}

function Camera (opts) {
  const gl = opts.ctx.gl
  this.type = 'Camera'
  this.changed = new Signal()

  // camera
  this.fov = Math.PI / 4
  this.aspect = 1
  this.near = 0.1
  this.far = 100
  this.backgroundColor = [0, 0, 0, 1]
  this.projectionMatrix = mat4.perspective(mat4.create(), this.fov, this.aspect, this.near, this.far)
  this.viewMatrix = mat4.create()
  this.inverseViewMatrix = mat4.create()

  // postprocessing
  this.postprocess = true
  this.rgbm = false
  this.depthPrepass = true
  this.ssao = false
  this.ssaoIntensity = 5
  this.ssaoRadius = 12
  this.ssaoBias = 0.01
  this.ssaoBlurRadius = 2
  this.ssaoBlurSharpness = 10
  this.dof = false
  this.dofIterations = 1
  this.dofRange = 5
  this.dofRadius = 1
  this.dofDepth = 6.76
  this.exposure = 1
  this.fxaa = true
  this.fog = false
  this.bloom = false
  this.bloomRadius = 1
  this.bloomThreshold = 1
  this.bloomIntensity = 1
  this.sunColor = [0.98, 0.98, 0.7]
  this.sunDispertion = 0.2
  this.sunIntensity = 0.1
  this.inscatteringCoeffs = [0.3, 0.3, 0.3]
  this.fogColor = [0.5, 0.5, 0.5]
  this.fogStart = 5
  this.fogDensity = 0.15
  this.sunPosition = [1, 1, 1]
  this.viewport = [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight]
  this._textures = []

  this.set(opts)
}

Camera.prototype.init = function (entity) {
  this.entity = entity
}

Camera.prototype.set = function (opts) {
  Object.assign(this, opts)

  if (opts.camera) {
    // const camera = this.camera = opts.camera
    // this.projectionMatrix = camera.projectionMatrix
    // this.viewMatrix = camera.viewMatrix
    // this.position = camera.position
    // this.target = this.target
    // this.up = camera.up
  }

  if (opts.aspect || opts.near || opts.far || opts.fov) {
    mat4.perspective(this.projectionMatrix, this.fov, this.aspect, this.near, this.far)
  }

  if (opts.viewport) {
    const viewport = opts.viewport
    const aspect = viewport[2] / viewport[3]
    if (this.aspect !== aspect) {
      this.set({ aspect: aspect })
    }
    this._textures.forEach((tex) => {
      const expectedWidth = Math.floor(viewport[2] * (tex.sizeScale || 1))
      const expectedHeight = Math.floor(viewport[3] * (tex.sizeScale || 1))
      if (tex.width !== expectedWidth || tex.height !== expectedHeight) {
        // console.log('update texture size', tex.width, expectedWidth, tex.height, expectedHeight)
        this.ctx.update(tex, {
          width: expectedWidth,
          height: expectedHeight
        })
      }
    })
  }

  if (this.postprocess && this.ctx.capabilities.maxColorAttachments < 2) {
    this.postprocess = false
    console.log('pex-renderer', `disabling postprocess as MAX_COLOR_ATTACHMENTS=${this.ctx.capabilities.maxColorAttachments}`)
    console.log('pex-renderer ctx', this.ctx.capabilities)
  }

  if (this.postprocess && !this._fsqMesh) {
    this.initPostproces()
  }

  Object.keys(opts).forEach((prop) => this.changed.dispatch(prop))
}

Camera.prototype.initPostproces = function () {
  const ctx = this.ctx
  const precisionStr = `precision ${ctx.capabilities.maxPrecision} float;\n`
  const fsqPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const fsqFaces = [[0, 1, 2], [0, 2, 3]]

  const W = this.viewport[2]
  const H = this.viewport[3]

  this._fsqMesh = {
    attributes: {
      aPosition: ctx.vertexBuffer(fsqPositions)
    },
    indices: ctx.indexBuffer(fsqFaces)
  }

  this._frameColorTex = ctx.texture2D({
    name: 'frameColorTex',
    width: W,
    height: H,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })

  this._frameEmissiveTex = ctx.texture2D({
    name: 'frameColorTex',
    width: W,
    height: H,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })

  this._frameNormalTex = ctx.texture2D({
    name: 'frameNormalTex',
    width: W,
    height: H,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.Linear
  })

  this._frameDepthTex = ctx.texture2D({
    name: 'frameDepthTex',
    width: W,
    height: H,
    pixelFormat: ctx.PixelFormat.Depth,
    encoding: ctx.Encoding.Linear
  })

  this._frameAOTex = ctx.texture2D({ name: 'frameAOTex', width: W, height: H, pixelFormat: ctx.PixelFormat.RGBA8, encoding: ctx.Encoding.Linear })
  this._frameAOBlurTex = ctx.texture2D({ name: 'frameAOBlurTex', width: W, height: H, pixelFormat: ctx.PixelFormat.RGBA8, encoding: ctx.Encoding.Linear })
  this._frameDofBlurTex = ctx.texture2D({
    name: 'frameDofBlurTex',
    width: W,
    height: H,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })

  this._frameBloomHTex = ctx.texture2D({
    name: 'frameBloomHTex',
    width: W / 2,
    height: H / 2,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })
  this._frameBloomHTex.sizeScale = 0.5

  this._frameBloomVTex = ctx.texture2D({
    name: 'frameBloomVTex',
    width: W / 2,
    height: H / 2,
    pixelFormat: this.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA16F,
    encoding: this.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear
  })
  this._frameBloomVTex.sizeScale = 0.5

  this._textures = [
    this._frameColorTex,
    this._frameEmissiveTex,
    this._frameNormalTex,
    this._frameDepthTex,
    this._frameAOTex,
    this._frameAOBlurTex,
    this._frameDofBlurTex,
    this._frameBloomHTex,
    this._frameBloomVTex
  ]

  ctx.gl.getExtension('OES_texture_float ')
  this._ssaoKernelMap = ctx.texture2D({ width: 8, height: 8, data: ssaoKernelData, pixelFormat: ctx.PixelFormat.RGBA32F, encoding: ctx.Encoding.Linear, wrap: ctx.Wrap.Repeat })
  this._ssaoNoiseMap = ctx.texture2D({ width: 128, height: 128, data: ssaoNoiseData, pixelFormat: ctx.PixelFormat.RGBA32F, encoding: ctx.Encoding.Linear, wrap: ctx.Wrap.Repeat, mag: ctx.Filter.Linear, min: ctx.Filter.Linear })

  this._drawFrameNormalsFboCommand = {
    name: 'Camera.drawFrameNormals',
    pass: ctx.pass({
      name: 'Camera.drawFrameNormals',
      color: [ this._frameNormalTex ],
      depth: this._frameDepthTex,
      clearColor: [0, 0, 0, 0],
      clearDepth: 1
    })
  }

  this._drawFrameFboCommand = {
    name: 'Camera.drawFrame',
    pass: ctx.pass({
      name: 'Camera.drawFrame',
      color: [ this._frameColorTex, this._frameEmissiveTex ],
      depth: this._frameDepthTex,
      clearColor: this.backgroundColor
    })
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
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + SAO_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      uDepthMap: this._frameDepthTex,
      uNormalMap: this._frameNormalTex,
      uNoiseMap: this._ssaoNoiseMap
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
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
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
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
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
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
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
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BILATERAL_BLUR_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      depthMap: this._frameDepthTex,
      image: this._frameDofBlurTex,
      // direction: [0, State.bilateralBlurRadius] // TODO:
      direction: [0, 0.5]
    }
  }

  this._thresholdCmd = {
    name: 'Camera.threshold',
    pass: ctx.pass({
      name: 'Camera.threshold',
      color: [ this._frameBloomVTex ],
      clearColor: [1, 1, 1, 1]
    }),
    pipeline: ctx.pipeline({
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + THRESHOLD_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      image: this._frameColorTex,
      emissiveTex: this._frameEmissiveTex,
      // TODO: this should be called screenSize as it's used to calculate uv
      imageSize: [this._frameBloomVTex.width, this._frameBloomVTex.height],
    },
    viewport: [0, 0, this._frameBloomVTex.width, this._frameBloomVTex.height],
  }

  this._bloomHCmd = {
    name: 'Camera.bloomH',
    pass: ctx.pass({
      name: 'Camera.bloomH',
      color: [ this._frameBloomHTex ],
      clearColor: [1, 1, 1, 1]
    }),
    pipeline: ctx.pipeline({
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BLOOM_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      image: this._frameBloomVTex,
      imageSize: [this._frameBloomVTex.width, this._frameBloomVTex.height],
      direction: [0.5, 0]
    },
    viewport: [0, 0, this._frameBloomHTex.width, this._frameBloomHTex.height]
  }

  this._bloomVCmd = {
    name: 'Camera.bloomV',
    pass: ctx.pass({
      name: 'Camera.bloomV',
      color: [ this._frameBloomVTex ],
      clearColor: [1, 1, 0, 1]
    }),
    pipeline: ctx.pipeline({
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + BLOOM_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      image: this._frameBloomHTex,
      imageSize: [this._frameBloomHTex.width, this._frameBloomHTex.height],
      direction: [0, 0.5]
    },
    viewport: [0, 0, this._frameBloomVTex.width, this._frameBloomVTex.height]
  }

  // this._overlayProgram = ctx.program({ vert: POSTPROCESS_VERT, frag: POSTPROCESS_FRAG }) // TODO
  this._blitCmd = {
    name: 'Camera.blit',
    pipeline: ctx.pipeline({
      vert: precisionStr + POSTPROCESS_VERT,
      frag: precisionStr + POSTPROCESS_FRAG
    }),
    attributes: this._fsqMesh.attributes,
    indices: this._fsqMesh.indices,
    uniforms: {
      uOverlay: this._frameColorTex,
      uOverlayEncoding: this._frameColorTex.encoding,
      uViewMatrix: this.viewMatrix,
      depthMap: this._frameDepthTex,
      depthMapSize: [W, H],
      uBloomMap: this._frameBloomVTex,
      uEmissiveMap: this._frameEmissiveTex
    }
  }
}

Camera.prototype.update = function () {
  mat4.set(this.inverseViewMatrix, this.entity.transform.modelMatrix)
  mat4.set(this.viewMatrix, this.entity.transform.modelMatrix)
  mat4.invert(this.viewMatrix)
}

module.exports = function createCamera (opts) {
  return new Camera(opts)
}
