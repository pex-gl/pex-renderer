var Vec3 = require('pex-math/Vec3')
var Vec4 = require('pex-math/Vec4')
var Mat4 = require('pex-math/Mat4')
var Draw = require('pex-draw/Draw')
var fx = require('pex-fx')
var random = require('pex-random')
var MathUtils = require('pex-math/Utils')
var flatten = require('flatten')
var Skybox = require('./Skybox')
var SkyEnvMap = require('./SkyEnvMap')
var ReflectionProbe = require('./ReflectionProbe')
var fs = require('fs')
var AreaLightsData = require('./AreaLightsData')
var CommandQueue = require('./CommandQueue')

// pex-fx extensions, extending FXStage
require('./Postprocess')
require('./BilateralBlur')
require('./SSAO')

var SOLID_COLOR_VERT = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8')
var SOLID_COLOR_VERT = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8')
var SOLID_COLOR_FRAG = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8')
var SHOW_COLORS_VERT = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8')
var SHOW_COLORS_FRAG = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8')
var OVERLAY_VERT = fs.readFileSync(__dirname + '/glsl/Overlay.vert', 'utf8')
var OVERLAY_FRAG = fs.readFileSync(__dirname + '/glsl/Overlay.frag', 'utf8')

var State = {
  backgroundColor: [0.1, 0.1, 0.1, 1],
  sunPosition: [3, 0, 0],
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

  this._cmdQueue = new CommandQueue(ctx)

  this._debugDraw = new Draw(ctx)
  this._debug = false

  this._materials = []
  this._nodes = []

  this.initCommands()
  this.initMaterials()
  this.initSkybox()
  this.initShadowmaps()
  this.initPostproces()

  this._debugTexture = ctx.createTexture2D(null, width, height)
  this._debugFBO = ctx.createFramebuffer([{ texture: this._debugTexture }])
  this._debugClearCommand = this._cmdQueue.createClearCommand({
    framebuffer: this._debugFBO,
    color: [1, 1, 0, 1]
  })
  this._debugDrawCommand = this._cmdQueue.createDrawCommand({
    framebuffer: this._debugFBO
  })

  this._state = State

  if (initialState) {
    Object.assign(State, initialState)
  }
}

Renderer.prototype.initCommands = function () {
  var cmdQueue = this._cmdQueue
  this._clearCommand = cmdQueue.createClearCommand({
    color: State.backgroundColor,
    depth: 1
  })
}

Renderer.prototype.initMaterials = function () {
  var ctx = this._ctx
  this._solidColorProgram = ctx.createProgram(SOLID_COLOR_VERT, SOLID_COLOR_FRAG)
  this._showColorsProgram = ctx.createProgram(SHOW_COLORS_VERT, SHOW_COLORS_FRAG)
}

Renderer.prototype.initShadowmaps = function () {
  var ctx = this._ctx
  this._shadowMapFbo = ctx.createFramebuffer()
}

Renderer.prototype.initPostproces = function () {
  var ctx = this._ctx

  var fsqPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  var fsqFaces = [ [0, 1, 2], [0, 2, 3]]
  var fsqAttributes = [
    { data: fsqPositions, location: ctx.ATTRIB_POSITION }
  ]
  var fsqIndices = { data: fsqFaces }
  this._fsqMesh = ctx.createMesh(fsqAttributes, fsqIndices)

  this._frameColorTex = ctx.createTexture2D(null, this._width, this._height, { type: ctx.HALF_FLOAT })
  this._frameNormalTex = ctx.createTexture2D(null, this._width, this._height, { type: ctx.HALF_FLOAT })
  this._frameDepthTex = ctx.createTexture2D(null, this._width, this._height, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT })
  this._frameFbo = ctx.createFramebuffer([ { texture: this._frameColorTex }, { texture: this._frameNormalTex} ], { texture: this._frameDepthTex})

  this._overlayProgram = ctx.createProgram(OVERLAY_VERT, OVERLAY_FRAG)

  this._fx = fx(ctx)

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

  this.ssaoKernelMap = ctx.createTexture2D(ssaoKernelData, 8, 8, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true })
  this.ssaoNoiseMap = ctx.createTexture2D(ssaoNoiseData, 4, 4, { format: ctx.RGBA, type: ctx.FLOAT, minFilter: ctx.NEAREST, magFilter: ctx.NEAREST, repeat: true })
}

Renderer.prototype.initSkybox = function () {
  var cmdQueue = this._cmdQueue

  this._skyEnvMapTex = new SkyEnvMap(cmdQueue, State.sunPosition)
  this._skybox = new Skybox(cmdQueue, this._skyEnvMapTex)
  this._reflectionProbe = new ReflectionProbe(cmdQueue, [0, 0, 0])

  // No need to set default props as these will be automatically updated on first render
  this._sunLightNode = this.createNode({
    light: {
      type: 'directional'
    }
  })
}

Renderer.prototype.addNode = function (node) {
  this._nodes.push(node)
  return node
}

Renderer.prototype.addMaterial = function (material) {
  this._materials.push(material)
  return material
}

Renderer.prototype.createNode = function (props) {
  var node = {}
  for (var propName in props) {
    node[propName] = props[propName]
  }
  this.initNode(node)
  return this.addNode(node) // TODO: don't add newly created node, e.g. gltfl loader would like to first create nodes then add them
}

Renderer.prototype.initNode = function (node) {
  var ctx = this._ctx

  if (!node.position) node.position = [0, 0, 0]
  if (!node.scale) node.scale = [1, 1, 1]
  if (!node.rotation) node.rotation = [0, 0, 0, 1]

  if (node.enabled === undefined) node.enabled = true
  node._parent = null
  node._children = []
  node._localTransform = Mat4.create()
  node._globalTransform = Mat4.create()
  node._prevPosition = Vec3.copy(node.position)

  if (node.mesh) {
    var material = node.material
    if (!material) { material = node.material = {} }
    if (!material.baseColorMap && (material.baseColor === undefined)) { material.baseColor = [0.95, 0.95, 0.95, 1] }
    if (!material.emissiveColorMap && (material.emissiveColor === undefined)) { material.emissiveColor = [0.0, 0.0, 0.0, 1] }
    if (!material.metallicMap && (material.metallic === undefined)) { material.metallic = 0.0 }
    if (!material.roughnessMap && (material.roughness === undefined)) { material.roughness = 0.5 }
    if (!material._uniforms) { material._uniforms = {}}
  }
  if (node.light) {
    if (node.light.type === 'directional') {
      if (node.light.shadows === undefined) { node.light.shadows = true }
      if (node.light.color === undefined) { node.light.color = [1, 1, 1, 1] }
      if (node.light.direction === undefined) { node.light.direction = [0, -1, 0] }
      node.light._colorMap = ctx.createTexture2D(null, 1024, 1024) // TODO: remove this
      node.light._shadowMap = ctx.createTexture2D(null, 1024, 1024, { format: ctx.DEPTH_COMPONENT, type: ctx.UNSIGNED_SHORT})
      node.light._viewMatrix = Mat4.create()
      node.light._projectionMatrix = Mat4.create()
      node.light._prevDirection = [0, 0, 0]
    } else if (node.light.type === 'point') {
      if (node.light.radius === undefined) { node.light.radius = 10 }
    } else if (node.light.type === 'area') {
    } else {
      throw new Error('Renderer.initNode unknown light type ' + node.light.type)
    }
  }
}

Renderer.prototype.getNodes = function (type) {
  return this._nodes.filter(function (node) { return node[type] != null })
}

Renderer.prototype.updateDirectionalLightShadowMap = function (lightNode) {
  var ctx = this._ctx

  ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT)
  ctx.bindFramebuffer(this._shadowMapFbo)

  var light = lightNode.light

  var target = Vec3.copy(lightNode.position)
  Vec3.add(target, light.direction)
  Mat4.lookAt(light._viewMatrix, lightNode.position, target, [0, 1, 0])
  Mat4.ortho(light._projectionMatrix, light._left, light._right, light._bottom, light._top, light._near, light._far)

  ctx.setViewMatrix(light._viewMatrix)
  ctx.setProjectionMatrix(light._projectionMatrix)
  this._shadowMapFbo.setColorAttachment(0, light._colorMap.getTarget(), light._colorMap.getHandle(), 0)
  this._shadowMapFbo.setDepthAttachment(light._shadowMap.getTarget(), light._shadowMap.getHandle(), 0)

  ctx.setViewport(0, 0, light._shadowMap.getWidth(), light._shadowMap.getHeight())

  ctx.setDepthTest(true)
  ctx.setClearColor(0, 0, 0, 1)
  ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT)
  ctx.setColorMask(0, 0, 0, 0)
  this.drawMeshes()
  ctx.setColorMask(1, 1, 1, 1)

  ctx.popState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT)
}

var Vert = fs.readFileSync(__dirname + '/glsl/PBR.vert', 'utf8')
var Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8')

// TODO: how fast is building these flag strings every frame for every object?
Renderer.prototype.getMeshProgram = function (meshMaterial, options) {
  // var USE_BASE_COLOR_MAP = 1 << 0
  // var USE_METALLIC_MAP   = 1 << 1
  // var USE_ROUGHNESS_MAP  = 1 << 2
  // var USE_NORMAL_MAP     = 1 << 3

  var ctx = this._ctx

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
  flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + options.numDirectionalLights)
  flags.push('#define NUM_POINT_LIGHTS ' + options.numPointLights)
  flags.push('#define NUM_AREA_LIGHTS ' + options.numAreaLights)
  if (options.useReflectionProbes) {
    flags.push('#define USE_REFLECTION_PROBES')
  }
  flags = flags.join('\n') + '\n'

  if (!this._programCache) {
    this._programCache = {}

    if (State.watchShaders) {
      fs.watch(__dirname + '/glsl/PBR.frag', {}, function () {
        setTimeout(function () {
          Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8')
          this._programCache = {}
        }.bind(this), 500)
      }.bind(this))
    }
  }

  var vertSrc = meshMaterial.vert || Vert
  var fragSrc = flags + (meshMaterial.frag || Frag)
  var hash = vertSrc + fragSrc

  var program = this._programCache[hash]
  if (!program) {
    program = this._programCache[hash] = ctx.createProgram(vertSrc, fragSrc)
  }
  return program
}

function applyUniforms (ctx, program, uniforms, textureOffset) {
  var numTextures = textureOffset
  for (var uniformName in uniforms) {
    // TODO: can i do array index check instead of function call?
    if (!program.hasUniform(uniformName)) {
      continue
    }
    var value = uniforms[uniformName]
    if (value === null || value === undefined) {
      if (program._uniforms[uniformName]) {
        throw new Error('Null uniform value for ' + uniformName + ' in PBRMaterial')
      } else {
        // console.log('Unnecessary uniform', uniformName)
        continue
      }
    }
    if (value.getTarget && (value.getTarget() === ctx.TEXTURE_2D || value.getTarget() === ctx.TEXTURE_CUBE_MAP)) {
      ctx.bindTexture(value, numTextures)
      value = numTextures++
    }
    State.uniformsSet++
    program.setUniform(uniformName, value)
  }
  return numTextures
}

// sort meshes by material
// do material search by props not string concat
// set global uniforms like lights once
// set update transforms once per frame
// draw + shadowmap @ 1000 objects x 30 uniforms = 60'000 setters / frame!!
// transform feedback?
Renderer.prototype.drawMeshes = function () {
  var ctx = this._ctx

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.time('drawMeshes')

  var cameraNodes = this.getNodes('camera')
  var meshNodes = this.getNodes('mesh').filter(function (node) { return node.enabled })
  var lightNodes = this.getNodes('light').filter(function (node) { return node.enabled })
  var directionalLightNodes = lightNodes.filter(function (node) { return node.light.type === 'directional'})
  var pointLightNodes = lightNodes.filter(function (node) { return node.light.type === 'point'})
  var areaLightNodes = lightNodes.filter(function (node) { return node.light.type === 'area'})

  ctx.pushState(ctx.CULL_BIT | ctx.DEPTH_BIT)
  ctx.setDepthTest(true)
  ctx.setCullFace(true)
  ctx.setCullFaceMode(ctx.BACK)

  var sharedUniforms = {
    uReflectionMap: this._reflectionProbe.getReflectionMap(),
    uIrradianceMap: this._reflectionProbe.getIrradianceMap(),
    uReflectionMapFlipEnvMap: this._reflectionProbe.getReflectionMap().getFlipEnvMap ? this._reflectionProbe.getReflectionMap().getFlipEnvMap() : -1,
    uIrradianceMapFlipEnvMap: this._reflectionProbe.getIrradianceMap().getFlipEnvMap ? this._reflectionProbe.getIrradianceMap().getFlipEnvMap() : -1,
    uCameraPosition: cameraNodes[0].camera.getPosition()
  }

  if (!this.areaLightTextures) {
    console.log('creating textures')
    this.ltc_mat_texture = ctx.createTexture2D(new Float32Array(AreaLightsData.mat), 64, 64, { type: ctx.FLOAT, flipY: false })
    this.ltc_mag_texture = ctx.createTexture2D(new Float32Array(AreaLightsData.mag), 64, 64, { type: ctx.FLOAT, format: ctx.getGL().ALPHA, flipY: false })
    this.areaLightTextures = true
  }
  sharedUniforms.ltc_mat = this.ltc_mat_texture
  sharedUniforms.ltc_mag = this.ltc_mag_texture

  directionalLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.light
    sharedUniforms['uDirectionalLights[' + i + '].position'] = lightNode.position
    sharedUniforms['uDirectionalLights[' + i + '].direction'] = light.direction
    sharedUniforms['uDirectionalLights[' + i + '].color'] = light.color
    sharedUniforms['uDirectionalLights[' + i + '].projectionMatrix'] = light._projectionMatrix
    sharedUniforms['uDirectionalLights[' + i + '].viewMatrix'] = light._viewMatrix
    sharedUniforms['uDirectionalLights[' + i + '].near'] = light._near
    sharedUniforms['uDirectionalLights[' + i + '].far'] = light._far
    sharedUniforms['uDirectionalLights[' + i + '].bias'] = State.bias
    sharedUniforms['uDirectionalLights[' + i + '].shadowMapSize'] = [light._shadowMap.getWidth(), light._shadowMap.getHeight()]
    sharedUniforms['uDirectionalLightShadowMaps[' + i + ']'] = light._shadowMap
  })

  pointLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.light
    sharedUniforms['uPointLights[' + i + '].position'] = lightNode.position
    sharedUniforms['uPointLights[' + i + '].color'] = light.color
    sharedUniforms['uPointLights[' + i + '].radius'] = light.radius
  })

  areaLightNodes.forEach(function (lightNode, i) {
    var light = lightNode.light
    sharedUniforms['uAreaLights[' + i + '].position'] = lightNode.position
    sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity
    sharedUniforms['uAreaLights[' + i + '].rotation'] = lightNode.rotation
    sharedUniforms['uAreaLights[' + i + '].size'] = [lightNode.scale[0] / 2, lightNode.scale[1] / 2]
  })

  var sharedTextureOffset = 0
  var prevProgram = null
  meshNodes.forEach(function (meshNode) {
    // TODO: i should only set either texture or the value
    var pbrUniforms = {
      uIor: 1.4,
      uBaseColor: meshNode.material.baseColor,
      uBaseColorMap: meshNode.material.baseColorMap,
      uEmissiveColor: meshNode.material.emissiveColor,
      uEmissiveColorMap: meshNode.material.emissiveColorMap,
      uMetallic: meshNode.material.metallic || 0.1,
      uMetallicMap: meshNode.material.metallicMap,
      uRoughness: meshNode.material.roughness || 1,
      uRoughnessMap: meshNode.material.roughnessMap,
      uNormalMap: meshNode.material.normalMap
    }

    var meshUniforms = meshNode.material.uniforms

    var meshProgram = meshNode.material._program = meshNode.material._program || this.getMeshProgram(meshNode.material, {
      numDirectionalLights: directionalLightNodes.length,
      numPointLights: pointLightNodes.length,
      numAreaLights: areaLightNodes.length,
      useReflectionProbes: true
    })

    ctx.bindProgram(meshProgram)
    if (meshProgram !== prevProgram) {
      sharedTextureOffset = applyUniforms(ctx, meshProgram, sharedUniforms, 0)
      prevProgram = meshProgram
    }
    var textureOffset = sharedTextureOffset
    textureOffset = applyUniforms(ctx, meshProgram, pbrUniforms, textureOffset)
    applyUniforms(ctx, meshProgram, meshUniforms, textureOffset)
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

    var isVertexArray = meshNode.primitiveType && meshNode.count

    if (meshNode.material.lineWidth) {
      ctx.setLineWidth(meshNode.material.lineWidth)
    }

    if (isVertexArray) {
      ctx.bindVertexArray(meshNode.mesh)
    } else {
      ctx.bindMesh(meshNode.mesh)
    }

    ctx.pushModelMatrix()
    ctx.loadIdentity()
    ctx.multMatrix(meshNode._globalTransform)

    if (isVertexArray) {
      ctx.drawElements(meshNode.primitiveType, meshNode.count, 0)
    } else if (meshNode.mesh._hasDivisor) {
      ctx.drawMesh(meshNode.mesh.getAttribute(ctx.ATTRIB_CUSTOM_0).data.length)
    } else {
      ctx.drawMesh()
    }
    ctx.popModelMatrix()

    if (meshNode.material.lineWidth) {
      ctx.setLineWidth(1)
    }
  }.bind(this))

  ctx.bindProgram(this._solidColorProgram)
  this._solidColorProgram.setUniform('uColor', [1, 0, 0, 1])

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

  ctx.popState()

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('drawMeshes')
}

Renderer.prototype.updateDirectionalLights = function (directionalLightNodes) {
  var sunLightNode = this._sunLightNode
  var sunLight = sunLightNode.light

  Vec3.set(sunLightNode.position, State.sunPosition)
  Vec3.scale(sunLightNode.position, 7.5) // TODO: set sun light node position based on bounding box

  Vec3.set(sunLight.direction, State.sunPosition)
  Vec3.scale(sunLight.direction, -1.0)
  Vec3.normalize(sunLight.direction)

  Vec3.set(sunLight.color, State.sunColor)

  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.light
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
  var ctx = this._ctx
  var cmdQueue = this._cmdQueue

  ctx.pushState(ctx.ALL)

  cmdQueue.submit(this._clearCommand)

  var cameraNodes = this.getNodes('camera')
  var lightNodes = this.getNodes('light')
  var directionalLightNodes = lightNodes.filter(function (node) { return node.light.type === 'directional'})
  // var pointLightNodes = lightNodes.filter(function (node) { return node.light.type === 'point'})
  var overlayNodes = this.getNodes('overlay')

  if (cameraNodes.length === 0) {
    console.log('WARN: Renderer.draw no cameras found')
    return
  }

  this.updateDirectionalLights(directionalLightNodes)
  if (!Vec3.equals(State.prevSunPosition, State.sunPosition)) {
    Vec3.set(State.prevSunPosition, State.sunPosition)

    // TODO: update sky only if it's used
    this._skyEnvMapTex.setSunPosition(State.sunPosition)
    this._skybox.setEnvMap(State.skyEnvMap || this._skyEnvMapTex)
    this._reflectionProbe.update(function () {
      this._skybox.draw()
    }.bind(this))
  }
  /*
  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.light
    var positionHasChanged = !Vec3.equals(lightNode.position, lightNode._prevPosition)
    var directionHasChanged = !Vec3.equals(light.direction, light._prevDirection)
    if (positionHasChanged || directionHasChanged) {
      Vec3.set(lightNode._prevPosition, lightNode.position)
      Vec3.set(light._prevDirection, light.direction)
      this.updateDirectionalLightShadowMap(lightNode)
    }
  }.bind(this))

  // update scene graph

  // TODO: optimize this
  this._nodes.forEach(function (node) {
    Mat4.identity(node._localTransform)
    Mat4.translate(node._localTransform, node.position)
    Mat4.mult(node._localTransform, Mat4.fromQuat(Mat4.create(), node.rotation))
    Mat4.scale(node._localTransform, node.scale)

    if (node.transform) { // TODO: required for GLTF
      Mat4.mult(node._localTransform, node.transform)
    }
  })

  this._nodes.forEach(function (node) {
    Mat4.identity(node._globalTransform)

    var parent = node._parent
    var stack = [ node._localTransform ]
    while (parent) {
      stack.push(parent._localTransform)
      parent = parent._parent
    }
    stack.reverse()
    stack.forEach(function (mat) {
      Mat4.mult(node._globalTransform, mat)
    })
  })

  // draw scene

  ctx.pushState(ctx.FRAMEBUFFER_BIT | ctx.VIEWPORT_BIT)
  ctx.bindFramebuffer(this._frameFbo)
  ctx.setViewport(0, 0, this._width, this._height)

  ctx.clear(ctx.COLOR_BIT | ctx.DEPTH_BIT)
  */
  var currentCamera = cameraNodes[0].camera
  ctx.setViewMatrix(currentCamera.getViewMatrix())
  ctx.setProjectionMatrix(currentCamera.getProjectionMatrix())
  this._skybox.draw()

  cmdQueue.submit(this._debugClearCommand)
  cmdQueue.submit(this._debugDrawCommand, null, function () {
    this._skybox.draw()
  }.bind(this))
  /*
  if (State.profile) {
    console.time('Renderer:drawMeshes')
    console.time('Renderer:drawMeshes:finish')
    State.uniformsSet = 0
  }
  this.drawMeshes()
  if (State.profile) {
    console.timeEnd('Renderer:drawMeshes')
    ctx.getGL().finish()
    console.timeEnd('Renderer:drawMeshes:finish')
    console.log('Renderer:uniformsSet', State.uniformsSet)
  }

  ctx.popState()
  var W = this._width
  var H = this._height

  var root = this._fx.reset()
  var color = root.asFXStage(this._frameColorTex, 'img')
  var final = color

  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.time('postprocessing')
  if (State.profile) console.time('ssao')
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
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('ssao')

  if (State.profile) console.time('postprocess')
  final = final.postprocess({ exposure: State.exposure })
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('postprocess')

  if (State.profile) console.time('fxaa')
  if (State.fxaa) {
    final = final.fxaa()
  }
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('fxaa')
  if (State.profile) ctx.getGL().finish()
  if (State.profile) console.timeEnd('postprocessing')
  var viewport = ctx.getViewport()
  final.blit({ x: viewport[0], y: viewport[1], width: viewport[2], height: viewport[3]})

  // overlays

  ctx.bindProgram(this._overlayProgram)
  this._overlayProgram.setUniform('uScreenSize', [this._width, this._height])
  this._overlayProgram.setUniform('uOverlay', 0)
  ctx.bindMesh(this._fsqMesh)
  ctx.setDepthTest(false)
  ctx.setBlend(true)
  ctx.setBlendFunc(ctx.ONE, ctx.ONE)
  overlayNodes.forEach(function (overlayNode) {
    ctx.bindTexture(overlayNode.overlay)
    ctx.drawMesh()
  })
  */
  ctx.popState()

  if (State.debug) {
    this.drawDebug()
  }
}

Renderer.prototype.drawDebug = function () {
  var ctx = this._ctx

  var lightNodes = this.getNodes('light')
  var directionalLightNodes = lightNodes.filter(function (node) { return node.light.type === 'directional'})
  ctx.bindProgram(this._showColorsProgram)
  this._debugDraw.setColor([1, 0, 0, 1])

  this._debugDraw.setLineWidth(2)
  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.light
    var invProj = Mat4.invert(Mat4.copy(light._projectionMatrix))
    var invView = Mat4.invert(Mat4.copy(light._viewMatrix))
    var corners = [[-1, -1, 1, 1], [1, -1, 1, 1], [1, 1, 1, 1], [-1, 1, 1, 1], [-1, -1, -1, 1], [1, -1, -1, 1], [1, 1, -1, 1], [-1, 1, -1, 1]].map(function (p) {
      var v = Vec4.multMat4(Vec4.multMat4(Vec4.copy(p), invProj), invView)
      Vec3.scale(v, 1 / v[3])
      return v
    })

    var position = lightNode.position
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
}

module.exports = Renderer
