const Vec3 = require('pex-math/Vec3')
const Vec4 = require('pex-math/Vec4')
const Mat3 = require('pex-math/Mat3')
const Mat4 = require('pex-math/Mat4')
// var Draw = require('pex-draw/Draw')
// var fx = require('pex-fx')
const random = require('pex-random')
const MathUtils = require('pex-math/Utils')
const flatten = require('flatten')
const glsl = require('glslify')
// const AreaLightsData = require('./AreaLightsData')
const createTreeNode = require('scene-tree')
const createProfiler = require('./profiler')
const isBrowser = require('is-browser')
const createEntity = require('./entity')
const createTransform = require('./transform')
const createSkin = require('./skin')
const createMorph = require('./morph')
const createGeometry = require('./geometry')
const createMaterial = require('./material')
const createCamera = require('./camera')
const createDirectionalLight = require('./directional-light')
const createPointLight = require('./point-light')
const createAreaLight = require('./area-light')
const createReflectionProbe = require('./reflection-probe')
const createSkybox = require('./skybox')

// pex-fx extensions, extending FXStage
// require('./Postprocess')
// require('./BilateralBlur')
// require('./SSAO')

const DEPTH_PASS_VERT = glsl(__dirname + '/glsl/DepthPass.vert')
const DEPTH_PASS_FRAG = glsl(__dirname + '/glsl/DepthPass.frag')
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_FRAG = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8')
// var SHOW_COLORS_VERT = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8')
// var SHOW_COLORS_FRAG = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8')
const OVERLAY_VERT = glsl(__dirname + '/glsl/Overlay.vert')
const OVERLAY_FRAG = glsl(__dirname + '/glsl/Overlay.frag')

var State = {
  backgroundColor: [0.1, 0.1, 0.1, 1],
  depthPrepass: true,
  // sunPosition: [3, 3, 0],
  // sunColor: [5, 5, 5, 1],
  // prevSunPosition: [0, 0, 0],
  exposure: 1,
  frame: 0,
  ssao: true,
  fxaa: true,
  ssaoDownsample: 2,
  ssaoSharpness: 1,
  ssaoRadius: 0.2,
  shadows: true,
  shadowQuality: 2,
  debug: false,
  profile: false,
  watchShaders: false,
  useNewPBR: true,
  // skyEnvMap: null,
  profiler: null,
  paused: false
}

// opts = Context
// opts = { ctx: Context, width: Number, height: Number, profile: Boolean }
function Renderer (opts) {
  this.entities = []
  this.root = this.entity()

  // check if we passed gl context or options object
  opts = opts.texture2D ? { ctx: opts } : opts

  this._ctx = opts.ctx
  this._width = opts.width || opts.ctx.gl.drawingBufferWidth
  this._height = opts.height || opts.ctx.gl.drawingBufferHeight

  // this._debugDraw = new Draw(ctx)
  this._debug = false

  if (opts.profile) {
    State.profiler = createProfiler(opts.ctx)
  }

  if (opts.pauseOnBlur && isBrowser) {
    window.addEventListener('focus', () => {
      State.paused = false
    })
    window.addEventListener('blur', () => {
      State.paused = true
    })
  }

  this._root = createTreeNode()
  this._rootNodeList = this._root.list()
  this._rootPrevSortVersion = -1

  // TODO: move from State object to internal probs and renderer({ opts }) setter?
  Object.assign(State, opts)
  this._state = State

  // this.initMaterials()
  // this.initSkybox()
  this.initPostproces()
}

// Renderer.prototype.initMaterials = function () {
  // var ctx = this._ctx
  // this._solidColorProgram = ctx.createProgram(SOLID_COLOR_VERT, SOLID_COLOR_FRAG)
  // this._showColorsProgram = ctx.createProgram(SHOW_COLORS_VERT, SHOW_COLORS_FRAG)
// }

// TODO: move ssao kernels to pex-fx
Renderer.prototype.initPostproces = function () {
  var ctx = this._ctx

  var fsqPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var fsqFaces = [[0, 1, 2], [0, 2, 3]]
  this._fsqMesh = {
    attributes: {
      aPosition: ctx.vertexBuffer(fsqPositions)
    },
    indices: ctx.indexBuffer(fsqFaces)
  }

  this._frameColorTex = ctx.texture2D({ width: this._width, height: this._height })
  this._frameNormalTex = ctx.texture2D({ width: this._width, height: this._height })
  this._frameDepthTex = ctx.texture2D({ width: this._width, height: this._height, format: ctx.PixelFormat.Depth })

  this._drawFrameFboCommand = {
    name: 'drawFrame',
    pass: ctx.pass({
      // color: [ this._frameColorTex, this._frameNormalTex ],
      color: [ this._frameColorTex ],
      depth: this._frameDepthTex,
      clearColor: State.backgroundColor,
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
      uScreenSize: [this._width, this._height],
      uOverlay: this._frameColorTex
    }
  }

  // this._fx = fx(ctx) // TODO

  var ssaoKernel = []
  for (var i = 0; i < 64; i++) {
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
  for (var j = 0; j < 64; j++) {
    var noiseSample = [
      random.float() * 2 - 1,
      random.float() * 2 - 1,
      0,
      1
    ]
    ssaoNoise.push(noiseSample)
  }
  var ssaoNoiseData = new Float32Array(flatten(ssaoNoise))

  ctx.gl.getExtension('OES_texture_float ')
  this.ssaoKernelMap = ctx.texture2D({ width: 8, height: 8, data: ssaoKernelData, format: ctx.PixelFormat.RGBA32F, wrap: ctx.Wrap.Repeat })
  this.ssaoNoiseMap = ctx.texture2D({ width: 8, height: 8, data: ssaoNoiseData, format: ctx.PixelFormat.RGBA32F, wrap: ctx.Wrap.Repeat })

  var err = ctx.gl.getError()
  if (err) throw new Error(err)
}

// Renderer.prototype.initSkybox = function () {
  // const ctx = this._ctx

  // No need to set default props as these will be automatically updated on first render
  // this._sunLightNode = this.createNode({
    // light: {
      // type: 'directional',
      // color: [1, 1, 1, 1]
    // }
  // })
  // this._root.add(this._sunLightNode)
// }

Renderer.prototype.initNode = function (data) {
  if (!data.position) data.position = [0, 0, 0]
  if (!data.scale) data.scale = [1, 1, 1]
  if (!data.rotation) data.rotation = [0, 0, 0, 1]
  if (data.enabled === undefined) data.enabled = true

  if (data.mesh) {
    // remove this
  }

  if (data.light) {
    var light = data.light
    if (light.type === 'directional') {

    } else if (data.light.type === 'point') {
      if (data.light.radius === undefined) { data.light.radius = 10 }
    } else if (data.light.type === 'area') {
    } else {
      throw new Error('Renderer.initNode unknown light type ' + data.light.type)
    }
  }

  return data
}

Renderer.prototype.updateDirectionalLightShadowMap = function (light) {
  const ctx = this._ctx
  const position = light.entity.transform.position
  Vec3.scale(position, 0)
  Vec3.sub(position, light.direction)
  Vec3.normalize(position)
  Vec3.scale(position, 7.5)
  const target = Vec3.copy(position)
  Vec3.add(target, light.direction)
  Mat4.lookAt(light._viewMatrix, position, target, [0, 1, 0])
  Mat4.ortho(light._projectionMatrix, light._left, light._right, light._bottom, light._top, light._near, light._far)

  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(light)
  })
}

var PBRVert = glsl(__dirname + '/glsl/PBR.vert')
var PBRFrag = glsl(__dirname + '/glsl/PBR.frag')

// TODO: how fast is building these flag strings every frame for every object?
Renderer.prototype.getMaterialProgram = function (geometry, material, skin, options) {
  var ctx = this._ctx

  if (!this._programCache) {
    this._programCache = {}
  }

  var flags = []

  if (geometry._attributes.aOffset) {
    flags.push('#define USE_INSTANCED_OFFSET')
  }
  if (geometry._attributes.aScale) {
    flags.push('#define USE_INSTANCED_SCALE')
  }
  if (geometry._attributes.aRotation) {
    flags.push('#define USE_INSTANCED_ROTATION')
  }
  if (skin) {
    flags.push('#define USE_SKIN')
    flags.push('#define NUM_JOINTS ' + skin.joints.length)
  }

  if (options.depthPassOnly) {
    const hash = 'DEPTH_PASS_ONLY_' + flags.join('-')
    let program = this._programCache[hash]
    flags = flags.join('\n')
    if (!program) {
      program = this._programCache[hash] = ctx.program({
        vert: flags + DEPTH_PASS_VERT,
        frag: flags + DEPTH_PASS_FRAG
      })
    }
    return program
  }

  if (geometry._attributes.aColor) {
    flags.push('#define USE_INSTANCED_COLOR')
  }

  flags.push('#define SHADOW_QUALITY ' + State.shadowQuality)

  if (material.baseColorMap) {
    flags.push('#define USE_BASE_COLOR_MAP')
  }
  if (material.metallicMap) {
    flags.push('#define USE_METALLIC_MAP')
  }
  if (material.roughnessMap) {
    flags.push('#define USE_ROUGHNESS_MAP')
  }
  if (material.normalMap) {
    flags.push('#define USE_NORMAL_MAP')
  }
  flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (options.numDirectionalLights || 0))
  flags.push('#define NUM_POINT_LIGHTS ' + (options.numPointLights || 0))
  flags.push('#define NUM_AREA_LIGHTS ' + (options.numAreaLights || 0))
  if (options.useReflectionProbes) {
    flags.push('#define USE_REFLECTION_PROBES')
  }
  flags = flags.join('\n') + '\n'

  var vertSrc = flags + PBRVert
  var fragSrc = flags + PBRFrag
  var hash = vertSrc + fragSrc

  var program = this._programCache[hash]
  if (!program) {
    program = this._programCache[hash] = ctx.program({ vert: vertSrc, frag: fragSrc })
  }
  return program
}

Renderer.prototype.traverseTransformTree = function (transform, beforeCallback, afterCallback) {
  beforeCallback(transform)
  transform.children.forEach((child) => {
    this.traverseTransformTree(child, beforeCallback, afterCallback)
  })
  if (afterCallback) afterCallback(transform)
}

Renderer.prototype.update = function () {
  this.traverseTransformTree(
    this.root.transform,
    (transform) => {
      transform.entity.components.forEach((component) => {
        if (component.update) component.update()
      })
    },
    (transform) => {
      transform.entity.components.forEach((component) => {
        if (component.afterUpdate) component.afterUpdate()
      })
    }
  )
}

Renderer.prototype.getGeometryPipeline = function (geometry, material, skin, opts) {
  const ctx = this._ctx
  const program = this.getMaterialProgram(geometry, material, skin, opts)
  if (!this._pipelineCache) {
    this._pipelineCache = {}
  }
  // TODO: better pipeline caching
  let pipeline = this._pipelineCache[material.id]
  // if (!pipeline) {
    pipeline = ctx.pipeline({
      program: program,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      depthFunc: material.depthFunc,
      depthFunc: ctx.DepthFunc.LessEqual,
      cullFaceEnabled: true,
      cullFace: ctx.Face.Back,
      primitive: geometry.primitive
    })
    this._pipelineCache[material.id] = pipeline
  // }

  return pipeline
}

Renderer.prototype.getComponents = function (type) {
  const result = []
  for (let i = 0; i < this.entities.length; i++) {
    const entity = this.entities[i]
    const component = entity.getComponent(type)
    if (component) {
      result.push(component)
    }
  }
  return result
}

// sort meshes by material
// do material search by props not string concat
// set global uniforms like lights once
// set update transforms once per frame
// draw + shadowmap @ 1000 objects x 30 uniforms = 60'000 setters / frame!!
// transform feedback?
Renderer.prototype.drawMeshes = function (shadowMappingLight) {
  const ctx = this._ctx

  if (State.profiler) State.profiler.time('drawMeshes')

  const cameraNodes = this.getComponents('Camera')
  const geometries = this.getComponents('Geometry')
  const directionalLights = this.getComponents('DirectionalLight')
  const pointLights = this.getComponents('PointLight')
  const areaLights = this.getComponents('AreaLight')
  const reflectionProbes = this.getComponents('ReflectionProbe')

  var sharedUniforms = this._sharedUniforms = this._sharedUniforms || {}

  // TODO:  find nearest reflection probe
  if (reflectionProbes.length > 0) {
    sharedUniforms.uReflectionMap = reflectionProbes[0]._reflectionMap
  }
  var camera = cameraNodes[0]
  if (shadowMappingLight) {
    sharedUniforms.uProjectionMatrix = shadowMappingLight._projectionMatrix
    sharedUniforms.uViewMatrix = shadowMappingLight._viewMatrix
  } else {
    sharedUniforms.uCameraPosition = camera.position
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix
    sharedUniforms.uViewMatrix = camera.viewMatrix
    sharedUniforms.uInverseViewMatrix = Mat4.invert(Mat4.copy(camera.viewMatrix))
  }


  directionalLights.forEach(function (light, i) {
    sharedUniforms['uDirectionalLights[' + i + '].direction'] = light.direction
    sharedUniforms['uDirectionalLights[' + i + '].color'] = light.color
    sharedUniforms['uDirectionalLights[' + i + '].projectionMatrix'] = light._projectionMatrix
    sharedUniforms['uDirectionalLights[' + i + '].viewMatrix'] = light._viewMatrix
    sharedUniforms['uDirectionalLights[' + i + '].near'] = light._near
    sharedUniforms['uDirectionalLights[' + i + '].far'] = light._far
    sharedUniforms['uDirectionalLights[' + i + '].bias'] = light.bias
    sharedUniforms['uDirectionalLights[' + i + '].shadowMapSize'] = [light._shadowMap.width, light._shadowMap.height]
    sharedUniforms['uDirectionalLightShadowMaps[' + i + ']'] = light._shadowMap
  })

  pointLights.forEach(function (light, i) {
    sharedUniforms['uPointLights[' + i + '].position'] = light.entity.transform.position
    sharedUniforms['uPointLights[' + i + '].color'] = light.color
    sharedUniforms['uPointLights[' + i + '].radius'] = light.radius
  })

  areaLights.forEach(function (light, i) {
    sharedUniforms.ltc_mat = light.ltc_mat_texture
    sharedUniforms.ltc_mag = light.ltc_mag_texture
    sharedUniforms['uAreaLights[' + i + '].position'] = light.entity.transform.position
    sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity
    sharedUniforms['uAreaLights[' + i + '].rotation'] = light.entity.transform.rotation
    sharedUniforms['uAreaLights[' + i + '].size'] = [light.entity.transform.scale[0] / 2, light.entity.transform.scale[1] / 2]
  })

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i]
    const transform = geometry.entity.transform
    const material = geometry.entity.getComponent('Material')
    const skin = geometry.entity.getComponent('Skin')
    const cachedUniforms = material._uniforms
    cachedUniforms.uIor = 1.4

    if (material.baseColorMap) cachedUniforms.uBaseColorMap = material.baseColorMap
    else cachedUniforms.uBaseColor = material.baseColor

    if (material.emissiveColorMap) cachedUniforms.uEmissiveColorMap = material.emissiveColorMap
    else cachedUniforms.uEmissiveColor = material.emissiveColor

    if (material.metallicMap) cachedUniforms.uMetallicMap = material.metallicMap
    else cachedUniforms.uMetallic = material.metallic

    if (material.roughnessMap) cachedUniforms.uRoughnessMap = material.roughnessMap
    else cachedUniforms.uRoughness = material.roughness

    if (material.normalMap) cachedUniforms.uNormalMap = material.normalMap

    if (material.uniforms) {
      for (var uniformName in material.uniforms) {
        cachedUniforms[uniformName] = material.uniforms[uniformName]
      }
    }

    if (skin) {
      cachedUniforms.uJointMat = skin.jointMatrices
    }

    let pipeline = null
    if (shadowMappingLight) {
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        depthPassOnly: true
      })
    } else {
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        numDirectionalLights: directionalLights.length,
        numPointLights: pointLights.length,
        numAreaLights: areaLights.length,
        useReflectionProbes: reflectionProbes.length // TODO: reflection probes true
      })
    }

    // TODO: shared uniforms HUH?
    // if (meshProgram !== prevProgram) {
      // prevProgram = meshProgram
      // // this is a bit hacky but prevents checking the same uniforms over and over again
      // // this would be even better if we sort meshes by material
    Object.assign(cachedUniforms, sharedUniforms)
    // }

    cachedUniforms.uModelMatrix = transform.modelMatrix

    // FIXME: this is expensive and not cached
    if (!shadowMappingLight) {
      var normalMat = Mat4.copy(camera.viewMatrix)
      Mat4.mult(normalMat, transform.modelMatrix)
      Mat4.invert(normalMat)
      Mat4.transpose(normalMat)
      cachedUniforms.uNormalMatrix = Mat3.fromMat4(Mat3.create(), normalMat)
    }
  
    ctx.submit({
      name: 'drawGeometry',
      attributes: geometry._attributes,
      indices: geometry._indices,
      pipeline: pipeline,
      uniforms: cachedUniforms,
      instances: geometry.instances,
    })
  }

  if (State.profiler) State.profiler.timeEnd('drawMeshes')
}

Renderer.prototype.draw = function () {
  const ctx = this._ctx

  if (State.paused) return

  this.update()

  if (State.profiler) State.profiler.startFrame()

  var cameras = this.getComponents('Camera')
  var directionalLights = this.getComponents('DirectionalLight')
  var skyboxes = this.getComponents('Skybox')
  var reflectionProbes = this.getComponents('ReflectionProbe')

  if (cameras.length === 0) {
    console.log('WARN: Renderer.draw no cameras found')
    return
  }

  directionalLights.forEach(function (light) {
    // TODO: sunLight frustum should come from the scene bounding box
    // var sunLightNode = this._sunLightNode
    // var sunLight = sunLightNode.data.light

    // // TODO: set sun light node position based on bounding box
    // sunLightNode.setPosition([State.sunPosition[0] * 7.5, State.sunPosition[1] * 7.5, State.sunPosition[2] * 7.5])

    // Vec3.set(sunLight.direction, State.sunPosition)
    // Vec3.scale(sunLight.direction, -1.0)
    // Vec3.normalize(sunLight.direction)

    // Vec3.set(sunLight.color, State.sunColor)
  })

  // TODO: update light probes
  /*
  if (!Vec3.equals(State.prevSunPosition, State.sunPosition)) {
    Vec3.set(State.prevSunPosition, State.sunPosition)

    // TODO: update sky only if it's used
    // TODO: implement
    if (State.skyEnvMap) {
      this._skybox.setEnvMap(State.skyEnvMap)
    } else {
      this._skyEnvMapTex.setSunPosition(State.sunPosition)
      this._skybox.setEnvMap(this._skyEnvMapTex.texture)
    }
  }
  */
  reflectionProbes.forEach((probe) => {
    // TODO: this should be just node.reflectionProbe
    if (probe.dirty) {
      probe.update((camera) => {
        if (skyboxes.length > 0) {
          skyboxes[0].draw(camera)
        }
      })
    }
  })

  // draw scene

  directionalLights.forEach((light) => {
    var directionHasChanged = !Vec3.equals(light.direction, light._prevDirection)
    if (directionHasChanged) {
      Vec3.set(light._prevDirection, light.direction)
      this.updateDirectionalLightShadowMap(light)
    }
  })

  var currentCamera = cameras[0]

  ctx.submit(this._drawFrameFboCommand, () => {
    // depth prepass
    if (State.depthPrepass) {
      ctx.gl.colorMask(0, 0, 0, 0)
      this.drawMeshes()
      ctx.gl.colorMask(1, 1, 1, 1)
    }
    this.drawMeshes()

    if (skyboxes.length > 0) {
      skyboxes[0].draw(currentCamera)
    }
  })
  ctx.submit(this._blitCmd, {
    uniforms: {
      uExposure: State.exposure
    }
  })

  /*

  var W = this._width
  var H = this._height

  var root = this._fx.reset()
  var color = root.asFXStage(this._frameColorTex, 'img')
  var final = color

  // FIXME: ssao internally needs uProjectionMatrix...
  ctx.pushProjectionMatrix()
  ctx.setProjectionMatrix(currentCamera.getProjectionMatrix())

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.time('Renderer:postprocessing')
  if (State.profile) console.time('Renderer:ssao')
  if (State.ssao) {
    var ssao = root.ssao({
      depthMap: this._frameDepthTex,
      normalMap: this._frameNormalTex,
      kernelMap: this.ssaoKernelMap,
      noiseMap: this.ssaoNoiseMap,
      camera: currentCamera,
      width: W / State.ssaoDownsample,
      height: H / State.ssaoDownsample,
      radius: State.ssaoRadius
    })
    ssao = ssao.bilateralBlur({ depthMap: this._frameDepthTex, camera: currentCamera, sharpness: State.ssaoSharpness })
    // TODO: this is incorrect, AO influences only indirect diffuse (irradiance) and indirect specular reflections
    // this will also influence direct lighting (lights, sun)
    final = color.mult(ssao, { bpp: 16 })
  }
  ctx.popProjectionMatrix()
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('Renderer:ssao')

  if (State.profile) console.time('Renderer:postprocess')
  final = final.postprocess({ exposure: State.exposure })
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('Renderer:postprocess')

  if (State.profile) console.time('Renderer:fxaa')
  if (State.fxaa) {
    final = final.fxaa()
  }
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('Renderer:fxaa')
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('Renderer:postprocessing')
  var viewport = ctx.getViewport()
  // final = ssao
  final.blit({ x: viewport[0], y: viewport[1], width: viewport[2], height: viewport[3]})

  // overlays

  // TODO: Implement overlays
  // ctx.bindProgram(this._overlayProgram)
  // this._overlayProgram.setUniform('uScreenSize', [this._width, this._height])
  // this._overlayProgram.setUniform('uOverlay', 0)
  // ctx.bindMesh(this._fsqMesh)
  // ctx.setDepthTest(false)
  // ctx.setBlend(true)
  // ctx.setBlendFunc(ctx.ONE, ctx.ONE)

  // overlayNodes.forEach(function (overlayNode) {
    // ctx.bindTexture(overlayNode.overlay)
    // ctx.drawMesh()
  // })

  if (State.debug) {
    this.drawDebug()
  }

  cmdQueue.flush()
  */
  if (State.profiler) State.profiler.endFrame()
}

Renderer.prototype.drawDebug = function () {
  var ctx = this._ctx

  var directionalLightNodes = this._directionalLightNodes
  ctx.bindProgram(this._showColorsProgram)
  this._debugDraw.setColor([1, 0, 0, 1])

  this._debugDraw.setLineWidth(2)
  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.data.light
    var invProj = Mat4.invert(Mat4.copy(light._projectionMatrix))
    var invView = Mat4.invert(Mat4.copy(light._viewMatrix))
    var corners = [[-1, -1, 1, 1], [1, -1, 1, 1], [1, 1, 1, 1], [-1, 1, 1, 1], [-1, -1, -1, 1], [1, -1, -1, 1], [1, 1, -1, 1], [-1, 1, -1, 1]].map(function (p) {
      var v = Vec4.multMat4(Vec4.multMat4(Vec4.copy(p), invProj), invView)
      Vec3.scale(v, 1 / v[3])
      return v
    })

    var position = lightNode.data.position
    this._debugDraw.drawLine(position, corners[0 + 4])
    this._debugDraw.drawLine(position, corners[1 + 4])
    this._debugDraw.drawLine(position, corners[2 + 4])
    this._debugDraw.drawLine(position, corners[3 + 4])
    this._debugDraw.drawLine(corners[3], corners[0])
    this._debugDraw.drawLine(corners[0], corners[1])
    this._debugDraw.drawLine(corners[1], corners[2])
    this._debugDraw.drawLine(corners[2], corners[3])
    this._debugDraw.drawLine(corners[3], corners[4 + 3])
    this._debugDraw.drawLine(corners[0], corners[4 + 0])
    this._debugDraw.drawLine(corners[1], corners[4 + 1])
    this._debugDraw.drawLine(corners[2], corners[4 + 2])
    this._debugDraw.drawLine(corners[4 + 3], corners[4 + 0])
    this._debugDraw.drawLine(corners[4 + 0], corners[4 + 1])
    this._debugDraw.drawLine(corners[4 + 1], corners[4 + 2])
    this._debugDraw.drawLine(corners[4 + 2], corners[4 + 3])
  }.bind(this))

  ctx.bindProgram(this._solidColorProgram)
  this._solidColorProgram.setUniform('uColor', [1, 0, 0, 1])

  /*
  // TODO: don't calculate debug node stack unless in debug
  this._nodes.forEach(function (node) {
    ctx.pushModelMatrix()
    if (node._globalTransform) {
      ctx.loadIdentity()
      ctx.multMatrix(node._globalTransform)
    }
    if (this._debug && node._bbox) {
      this._debugDraw.debugAABB(node._bbox)
    }
    ctx.popModelMatrix()
  }.bind(this))
  */
}

Renderer.prototype.entity = function (components, parent) {
  const entity = createEntity(components, parent || this.root)
  this.entities.push(entity)
  return entity
}

Renderer.prototype.transform = function (opts) {
  return createTransform(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.skin = function (opts) {
  return createSkin(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.morph = function (opts) {
  return createMorph(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.geometry = function (opts) {
  return createGeometry(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.material = function (opts) {
  return createMaterial(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.camera = function (opts) {
  return createCamera(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.directionalLight = function (opts) {
  return createDirectionalLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.pointLight = function (opts) {
  return createPointLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.areaLight = function (opts) {
  return createAreaLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.reflectionProbe = function (opts) {
  return createReflectionProbe(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.skybox = function (opts) {
  return createSkybox(Object.assign({ ctx: this._ctx }, opts))
}

module.exports = function createRenderer (opts) {
  return new Renderer(opts)
}
