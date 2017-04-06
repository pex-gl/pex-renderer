const Vec3 = require('pex-math/Vec3')
const Vec4 = require('pex-math/Vec4')
const Mat3 = require('pex-math/Mat3')
const Mat4 = require('pex-math/Mat4')
// var Draw = require('pex-draw/Draw')
// var fx = require('pex-fx')
const random = require('pex-random')
const MathUtils = require('pex-math/Utils')
const flatten = require('flatten')
// var Skybox = require('./Skybox')
// var SkyEnvMap = require('./SkyEnvMap')
// var ReflectionProbe = require('./ReflectionProbe')
const glsl = require('glslify')
var AreaLightsData = require('./AreaLightsData')
const createTreeNode = require('scene-tree')

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
  sunPosition: [3, 3, 0],
  sunColor: [1, 1, 1, 1],
  prevSunPosition: [0, 0, 0],
  exposure: 1,
  frame: 0,
  ssao: true,
  fxaa: true,
  ssaoDownsample: 2,
  ssaoSharpness: 1,
  ssaoRadius: 0.2,
  shadows: true,
  shadowQuality: 3,
  bias: 0.1,
  debug: false,
  profile: false,
  watchShaders: false
}

function Renderer (ctx, width, height, initialState) {
  this._ctx = ctx
  this._width = width
  this._height = height

  // this._debugDraw = new Draw(ctx)
  this._debug = false

  this._root = createTreeNode()
  this._rootNodeList = this._root.list()
  this._rootPrevSortVersion = -1

  this.initCommands()
  // this.initMaterials()
  this.initSkybox()
  this.initPostproces()

  this._state = State

  if (initialState) {
    Object.assign(State, initialState)
  }
}

Renderer.prototype.initCommands = function () {
  const ctx = this._ctx
  this._clearCommand = {
    pass: ctx.pass({
      clearColor: State.backgroundColor,
      clearDepth: 1
    })
  }
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

  this._frameColorTex = ctx.texture2D({ width: this._width, height: this._height, format: ctx.PixelFormat.RGBA32F }) //TODO: half float?, format: ctx.PixelFormat.{ type: ctx.HALF_FLOAT })
  this._frameNormalTex = ctx.texture2D({ width: this._width, height: this._height, format: ctx.PixelFormat.RGBA32F })// TODO: byte?, { type: ctx.HALF_FLOAT })
  this._frameDepthTex = ctx.texture2D({ width: this._width, height: this._height, format: ctx.PixelFormat.Depth })

  this._drawFrameFboCommand = {
    pass: ctx.pass({
      color: [ this._frameColorTex, this._frameNormalTex ],
      depth: this._frameDepthTex,
      clearColor: [1, 1, 0, 1],
      clearDepth: 1
    })
  }

  // this._overlayProgram = ctx.program({ vert: OVERLAY_VERT, frag: OVERLAY_FRAG }) // TODO
  this._blitCmd = {
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
  
  var err =  ctx.gl.getError()
  if (err) throw new Error(err)
}

Renderer.prototype.initSkybox = function () {
  var cmdQueue = this._cmdQueue

  // this._skyEnvMapTex = new SkyEnvMap(cmdQueue, State.sunPosition)
  // this._skybox = new Skybox(cmdQueue, this._skyEnvMapTex)
  // this._reflectionProbe = new ReflectionProbe(cmdQueue, [0, 0, 0])

  // No need to set default props as these will be automatically updated on first render
  this._sunLightNode = this.createNode({
    light: {
      type: 'directional'
    }
  })
  this._root.add(this._sunLightNode)
}

Renderer.prototype.add = function (node) {
  this._root.add(node)
  return node
}

Renderer.prototype.remove = function (node) {
  node.parent.remove(node)
}

Renderer.prototype.createNode = function (data) {
  return createTreeNode(this.initNode(data))
}

Renderer.prototype.initNode = function (data) {
  var ctx = this._ctx
  var cmdQueue = this._cmdQueue

  if (!data.position) data.position = [0, 0, 0]
  if (!data.scale) data.scale = [1, 1, 1]
  if (!data.rotation) data.rotation = [0, 0, 0, 1]

  if (data.enabled === undefined) data.enabled = true
  data._parent = null
  data._children = []
  data._localTransform = Mat4.create()
  data._globalTransform = Mat4.create()
  data._prevPosition = Vec3.copy(data.position)

  if (data.mesh) {
    var material = data.material
    if (!material) { material = data.material = {} }
    if (!material.baseColorMap && (material.baseColor === undefined)) { material.baseColor = [0.95, 0.95, 0.95, 1] }
    if (!material.emissiveColorMap && (material.emissiveColor === undefined)) { material.emissiveColor = [0.0, 0.0, 0.0, 1] }
    if (!material.metallicMap && (material.metallic === undefined)) { material.metallic = 0.01 }
    if (!material.roughnessMap && (material.roughness === undefined)) { material.roughness = 0.5 }
    if (!material._uniforms) { material._uniforms = {} }

    data._drawCommand = {
      name: 'DrawMesh_' + ((Math.random() * 100000) | 0), 
      attributes: data.mesh.attributes,
      indices: data.mesh.indices
      // primitiveType: data.primitiveType, // TODO: add primitive type support
      // uniforms: material._uniforms, // TODO: _uniforms support
      // lineWidth: material.lineWidth, // TODO: lineWidth support
      // depthTest: true,
      // cullFace: true,
      // cullFaceMode: ctx.BACK
    }
  }

  if (data.light) {
    var light = data.light
    if (light.type === 'directional') {
      if (light.shadows === undefined) { light.shadows = true }
      if (light.color === undefined) { light.color = [1, 1, 1, 1] }
      if (light.direction === undefined) { light.direction = [1, -1, 0] }
      light._colorMap = ctx.texture2D({ width: 1024, height: 1024 }) // FIXME: remove light color map
      light._shadowMap = ctx.texture2D({ width: 1024, height: 1024, format: ctx.PixelFormat.Depth })
      light._viewMatrix = Mat4.create()
      light._projectionMatrix = Mat4.create()
      light._prevDirection = [0, 0, 0]

      light._shadowMapDrawCommand = {
        pass: ctx.pass({
          color: [ light._colorMap ],
          depth: light._shadowMap,
          clearColor: [0, 0, 0, 1],
          clearDepth: 1
        })
        // colorMask: [0, 0, 0, 0] //TODO
      }
    } else if (data.light.type === 'point') {
      if (data.light.radius === undefined) { data.light.radius = 10 }
    } else if (data.light.type === 'area') {
    } else {
      throw new Error('Renderer.initNode unknown light type ' + data.light.type)
    }
  }

  return data
}

Renderer.prototype.getNodes = function (type) {
  return this._rootNodeList().filter(function (node) { return node.data[type] != null })
}

Renderer.prototype.updateDirectionalLightShadowMap = function (lightNode) {
  const ctx = this._ctx
  const light = lightNode.data.light

  const target = Vec3.copy(lightNode.data.position)
  Vec3.add(target, light.direction)
  Mat4.lookAt(light._viewMatrix, lightNode.data.position, target, [0, 1, 0])
  Mat4.ortho(light._projectionMatrix, light._left, light._right, light._bottom, light._top, light._near, light._far)

  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(light)
  })
}

var Vert = glsl(__dirname + '/glsl/PBR.vert')
var Frag = glsl(__dirname + '/glsl/PBR.frag')

// TODO: how fast is building these flag strings every frame for every object?
Renderer.prototype.getMeshProgram = function (meshMaterial, options) {
  var ctx = this._ctx

  if (!this._programCache) {
    this._programCache = {}
  }

  if (options.depthPassOnly) {
    const hash = 'DEPTH_PASS_ONLY'
    let program = this._programCache[hash]
    if (!program) {
      program = this._programCache[hash] = ctx.program({ vert: DEPTH_PASS_VERT, frag: DEPTH_PASS_FRAG })
    }
    return program
  }

  var flags = []
  flags.push('#define SHADOW_QUALITY_' + State.shadowQuality)

  if (meshMaterial.baseColorMap) {
    flags.push('#define USE_BASE_COLOR_MAP')
  }
  if (meshMaterial.metallicMap) {
    flags.push('#define USE_METALLIC_MAP')
  }
  if (meshMaterial.roughnessMap) {
    flags.push('#define USE_ROUGHNESS_MAP')
  }
  if (meshMaterial.normalMap) {
    flags.push('#define USE_NORMAL_MAP')
  }
  flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (options.numDirectionalLights || 0))
  flags.push('#define NUM_POINT_LIGHTS ' + (options.numPointLights || 0))
  flags.push('#define NUM_AREA_LIGHTS ' + (options.numAreaLights || 0))
  if (options.useReflectionProbes) {
    flags.push('#define USE_REFLECTION_PROBES')
  }
  flags = flags.join('\n') + '\n'

  var vertSrc = meshMaterial.vert || Vert
  var fragSrc = flags + (meshMaterial.frag || Frag)
  var hash = vertSrc + fragSrc

  var program = this._programCache[hash]
  if (!program) {
    program = this._programCache[hash] = ctx.program({ vert: vertSrc, frag: fragSrc })
  }
  return program
}

Renderer.prototype.getMeshPipeline = function (material, opts) {
  const ctx = this._ctx
  const program = this.getMeshProgram(material, opts)
  if (!this._pipelineCache) {
    this._pipelineCache = {}
  }
  // TODO: better pipeline caching
  let pipeline = this._pipelineCache[program.id]
  if (!pipeline) {
    pipeline = ctx.pipeline({
      program: program,
      depthEnabled: true
    })
    this._pipelineCache[program.id] = pipeline
  }

  return pipeline
}

Renderer.prototype.updateNodeLists = function () {
  this._cameraNodes = this.getNodes('camera')
  // TODO: reimplement node.enabled filtering
  this._meshNodes = this.getNodes('mesh')
    .concat(this.getNodes('vertexArray'))
    .filter(function (node) { return node.data.enabled })
  this._lightNodes = this.getNodes('light').filter(function (node) { return node.data.enabled })
  this._directionalLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'directional' })
  this._pointLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'point' })
  this._areaLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'area' })
}

// sort meshes by material
// do material search by props not string concat
// set global uniforms like lights once
// set update transforms once per frame
// draw + shadowmap @ 1000 objects x 30 uniforms = 60'000 setters / frame!!
// transform feedback?
Renderer.prototype.drawMeshes = function (shadowMappingLight) {
  const ctx = this._ctx

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.time('Renderer:drawMeshes')

  var cameraNodes = this._cameraNodes
  var meshNodes = this._meshNodes
  var directionalLightNodes = this._directionalLightNodes
  var pointLightNodes = this._pointLightNodes
  var areaLightNodes = this._areaLightNodes

  var sharedUniforms = this._sharedUniforms = this._sharedUniforms || {}
  // sharedUniforms.uReflectionMap = this._reflectionProbe.getReflectionMap()
  // sharedUniforms.uIrradianceMap = this._reflectionProbe.getIrradianceMap()
  // sharedUniforms.uReflectionMapFlipEnvMap = this._reflectionProbe.getReflectionMap().getFlipEnvMap ? this._reflectionProbe.getReflectionMap().getFlipEnvMap() : -1
  // sharedUniforms.uIrradianceMapFlipEnvMap = this._reflectionProbe.getIrradianceMap().getFlipEnvMap ? this._reflectionProbe.getIrradianceMap().getFlipEnvMap() : -1
  var camera = cameraNodes[0].data.camera
  if (shadowMappingLight) {
    sharedUniforms.uProjectionMatrix = shadowMappingLight._projectionMatrix
    sharedUniforms.uViewMatrix = shadowMappingLight._viewMatrix
  } else {
    sharedUniforms.uCameraPosition = camera.position
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix
    sharedUniforms.uViewMatrix = camera.viewMatrix
    sharedUniforms.uInverseViewMatrix = Mat4.invert(Mat4.copy(camera.viewMatrix))
  }




  if (!this.areaLightTextures) {
    this.ltc_mat_texture = ctx.texture2D({ data: AreaLightsData.mat, width: 64, height: 64, format: ctx.PixelFormat.RGBA32F })
    this.ltc_mag_texture = ctx.texture2D({ data: AreaLightsData.mag, width: 64, height: 64, format: ctx.PixelFormat.R32F })
    this.areaLightTextures = true
  }
  sharedUniforms.ltc_mat = this.ltc_mat_texture
  sharedUniforms.ltc_mag = this.ltc_mag_texture

  directionalLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.data.light
    sharedUniforms['uDirectionalLights[' + i + '].position'] = lightNode.data.position
    sharedUniforms['uDirectionalLights[' + i + '].direction'] = light.direction
    sharedUniforms['uDirectionalLights[' + i + '].color'] = light.color
    sharedUniforms['uDirectionalLights[' + i + '].projectionMatrix'] = light._projectionMatrix
    sharedUniforms['uDirectionalLights[' + i + '].viewMatrix'] = light._viewMatrix
    sharedUniforms['uDirectionalLights[' + i + '].near'] = light._near
    sharedUniforms['uDirectionalLights[' + i + '].far'] = light._far
    sharedUniforms['uDirectionalLights[' + i + '].bias'] = State.bias
    sharedUniforms['uDirectionalLights[' + i + '].shadowMapSize'] = [light._shadowMap.width, light._shadowMap.height]
    sharedUniforms['uDirectionalLightShadowMaps[' + i + ']'] = light._shadowMap
  })

  pointLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.data.light
    sharedUniforms['uPointLights[' + i + '].position'] = lightNode.data.position
    sharedUniforms['uPointLights[' + i + '].color'] = light.color
    sharedUniforms['uPointLights[' + i + '].radius'] = light.radius
  })

  areaLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.data.light
    sharedUniforms['uAreaLights[' + i + '].position'] = lightNode.data.position
    sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity
    sharedUniforms['uAreaLights[' + i + '].rotation'] = lightNode.data.rotation
    sharedUniforms['uAreaLights[' + i + '].size'] = [lightNode.data.scale[0] / 2, lightNode.data.scale[1] / 2]
  })

  var prevProgram = null
  for (var i = 0; i < meshNodes.length; i++) {
    var meshNode = meshNodes[i]
    var material = meshNode.data.material
    var cachedUniforms = material._uniforms
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

    // TODO: add shadow mapping pass support
    // var meshProgram
    // if (shadowMappingPass) {
      // meshProgram = material._shadowProgram = material._shadowProgram || this.getMeshProgram(material, {})
    // } else {
      // meshProgram = material._program = material._program || this.getMeshProgram(material, {
        // numDirectionalLights: directionalLightNodes.length,
        // numPointLights: pointLightNodes.length,
        // numAreaLights: areaLightNodes.length,
        // useReflectionProbes: true
      // })
    // }
    let pipeline = null
    if (shadowMappingLight) {
      pipeline = this.getMeshPipeline(material, { depthPassOnly: true })
    } else {
      pipeline = this.getMeshPipeline(material, {
        numDirectionalLights: directionalLightNodes.length,
        numPointLights: pointLightNodes.length,
        numAreaLights: areaLightNodes.length,
        useReflectionProbes: false // TODO: reflection probes true
      })
    }

    // TODO: shared uniforms HUH?
    // if (meshProgram !== prevProgram) {
      // prevProgram = meshProgram
      // // this is a bit hacky but prevents checking the same uniforms over and over again
      // // this would be even better if we sort meshes by material
      Object.assign(cachedUniforms, sharedUniforms)
    // }

    // TODO: is modelMatrix in command used?
    // meshNode.data._drawCommand.modelMatrix = meshNode.modelMatrix
    cachedUniforms.uModelMatrix = meshNode.modelMatrix
    if (!meshNode.modelMatrix) {
      throw new Error('Invalid mesh node')
    }

    // FIXME: this is expensive and not cached
    if (!shadowMappingLight) {
      var normalMat = Mat4.copy(camera.viewMatrix)
      Mat4.mult(normalMat, meshNode.modelMatrix)
      Mat4.invert(normalMat)
      Mat4.transpose(normalMat)
      cachedUniforms.uNormalMatrix = Mat3.fromMat4(Mat3.create(), normalMat)
    }

    // replacing program with pipeline
    // meshNode.data._drawCommand.program = meshProgram
    meshNode.data._drawCommand.pipeline = pipeline

    meshNode.data._drawCommand.uniforms = cachedUniforms

    ctx.submit(meshNode.data._drawCommand)

    // TODO: implement instancing support
    // if (meshNode.mesh._hasDivisor) {
    // ctx.bindProgram(this._standardInstancedProgram)
    // this._standardInstancedProgram.setUniform('uAlbedoColor', meshNode.material._albedoColor)
    // program = this._standardInstancedProgram
    // }
    // else if (meshNode.material._albedoColorTexture) {
    // ctx.bindProgram(this._standardProgramTextured)
    // this._standardProgramTextured.setUniform('uAlbedoColorTex', 2)
    // ctx.bindTexture(meshNode.material._albedoColorTexture, 2)
    // program = this._standardProgramTextured
    // }
    // else {
    // ctx.bindProgram(this._standardProgram)
    // this._standardProgram.setUniform('uAlbedoColor', meshNode.material._albedoColor)
    // program = this._standardProgram
    // }

    // TODO: implement vertex arrays
    // if (isVertexArray) {
      // ctx.drawElements(meshNode.primitiveType, meshNode.count, 0)
    // } else if (meshNode.mesh._hasDivisor) {
      // ctx.drawMesh(meshNode.mesh.getAttribute(ctx.ATTRIB_CUSTOM_0).data.length)
    // } else {
      // ctx.drawMesh()
    // }
  }

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('Renderer:drawMeshes')
}

Renderer.prototype.updateDirectionalLights = function (directionalLightNodes) {
  var sunLightNode = this._sunLightNode
  var sunLight = sunLightNode.data.light

  // TODO: set sun light node position based on bounding box
  sunLightNode.setPosition([State.sunPosition[0] * 7.5, State.sunPosition[1] * 7.5, State.sunPosition[2] * 7.5])

  Vec3.set(sunLight.direction, State.sunPosition)
  Vec3.scale(sunLight.direction, -1.0)
  Vec3.normalize(sunLight.direction)

  Vec3.set(sunLight.color, State.sunColor)

  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.data.light
    // TODO: sunLight frustum should come from the scene bounding box
    light._left = -8
    light._right = 8
    light._bottom = -8
    light._top = 8
    light._near = 2
    light._far = 40
  })
}

Renderer.prototype.draw = function () {
  const ctx = this._ctx

  this._root.tick()
  if (this._root.sortVersion !== this._rootPrevSortVersion) {
    this.updateNodeLists()
    this._rootPrevSortVersion = this._root.sortVersion
  }

  ctx.submit(this._clearCommand)

  var cameraNodes = this._cameraNodes
  var directionalLightNodes = this._directionalLightNodes
  // var pointLightNodes = lightNodes.filter(function (node) { return node.data.light.type === 'point'})
  // var overlayNodes = this.getNodes('overlay')

  if (cameraNodes.length === 0) {
    console.log('WARN: Renderer.draw no cameras found')
    return
  }

  this.updateDirectionalLights(directionalLightNodes)
  if (!Vec3.equals(State.prevSunPosition, State.sunPosition)) {
    Vec3.set(State.prevSunPosition, State.sunPosition)

    // TODO: update sky only if it's used
    // TODO: implement
    // this._skyEnvMapTex.setSunPosition(State.sunPosition)
    // this._skybox.setEnvMap(State.skyEnvMap || this._skyEnvMapTex)
    // this._reflectionProbe.update(function () {
      // this._skybox.draw()
    // }.bind(this))
  }

  // draw scene

  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.data.light
    var positionHasChanged = !Vec3.equals(lightNode.data.position, lightNode.data._prevPosition)
    var directionHasChanged = !Vec3.equals(light.direction, light._prevDirection)
    if (positionHasChanged || directionHasChanged) {
      Vec3.set(lightNode.data._prevPosition, lightNode.data.position)
      Vec3.set(light._prevDirection, light.direction)
      this.updateDirectionalLightShadowMap(lightNode) // TODO
    }
  }.bind(this))

  var currentCamera = cameraNodes[0].data.camera

  // ctx.submit(this._drawFrameFboCommand, () => {
    // projectionMatrix: currentCamera.getProjectionMatrix(),
    // viewMatrix: currentCamera.getViewMatrix()
  // }, function () {
    // this._skybox.draw()
    // if (State.profile) {
      // console.time('Renderer:drawMeshes')
      // console.time('Renderer:drawMeshes:finish')
      // State.uniformsSet = 0
    // }
    this.drawMeshes()
    // if (State.profile) {
      // console.timeEnd('Renderer:drawMeshes')
      // ctx.getGL().finish()
      // console.timeEnd('Renderer:drawMeshes:finish')
      // console.log('Renderer:uniformsSet', State.uniformsSet)
    // }
  // })
  // ctx.submit(this._blitCmd)
  //
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

module.exports = Renderer
