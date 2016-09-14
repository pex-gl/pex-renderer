var Vec3 = require('pex-math/Vec3')
var Vec4 = require('pex-math/Vec4')
var Mat3 = require('pex-math/Mat3')
var Mat4 = require('pex-math/Mat4')
var fx = require('./local_modules/pex-fx')
var random = require('pex-random')
var MathUtils = require('pex-math/Utils')
var flatten = require('flatten')
var Skybox = require('./Skybox')
var SkyEnvMap = require('./SkyEnvMap')
var ReflectionProbe = require('./ReflectionProbe')
var fs = require('fs')
// var AreaLightsData = require('./AreaLightsData')
var createTreeNode = require('scene-tree')

// pex-fx extensions, extending FXStage
require('./Postprocess')
require('./BilateralBlur')
require('./SSAO')

var SOLID_COLOR_VERT = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8')
var SOLID_COLOR_VERT = fs.readFileSync(__dirname + '/glsl/SolidColor.vert', 'utf8')
var SOLID_COLOR_FRAG = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8')
var SHOW_COLORS_VERT = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8')
var SHOW_COLORS_FRAG = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8')

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

function Renderer (regl, width, height, initialState) {
  this._regl = regl
  this._width = width
  this._height = height

  this._debug = false

  this._root = createTreeNode()
  this._rootNodeList = this._root.list()
  this._rootPrevSortVersion = -1

  // this.initCommands()
  // this.initMaterials()
  this.initSkybox()
  this.initPostproces()

  this._state = State

  if (initialState) {
    Object.assign(State, initialState)
  }
}

Renderer.prototype.initMaterials = function () {
  var ctx = this._ctx
  this._solidColorProgram = ctx.createProgram(SOLID_COLOR_VERT, SOLID_COLOR_FRAG)
  this._showColorsProgram = ctx.createProgram(SHOW_COLORS_VERT, SHOW_COLORS_FRAG)
}

// TODO: move ssao kernels to pex-fx
Renderer.prototype.initPostproces = function () {
  var regl = this._regl

  // var fsqPositions = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  // var fsqFaces = [ [0, 1, 2], [0, 2, 3]]
  // var fsqAttributes = [
    // { data: fsqPositions, location: ctx.ATTRIB_POSITION }
  // ]
  // var fsqIndices = { data: fsqFaces }
  // this._fsqMesh = ctx.createMesh(fsqAttributes, fsqIndices)

  this._frameColorTex = regl.texture({ width: this._width, height: this._height, type2: 'half float' }) // TODO
  this._frameNormalTex = regl.texture({ width: this._width, height: this._height, type2: 'half float' }) // TODO
  this._frameDepthTex = regl.texture({ width: this._width, height: this._height, type: 'depth stencil', format: 'depth stencil' })

  this._frameFbo = regl.framebuffer({
    color: [
      this._frameColorTex,
      this._frameNormalTex
    ],
    depthStencil: this._frameDepthTex
  })

  this._drawFrameFboCommand = regl({
    framebuffer: this._frameFbo,
    viewport: { x: 0, y: 0, width: this._width, height: this._height }
  })
  // this._overlayProgram = ctx.createProgram(OVERLAY_VERT, OVERLAY_FRAG)

  this._fx = fx(regl)

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

  this.ssaoKernelMap = regl.texture({
    data: ssaoKernelData,
    width: 8,
    height: 8,
    type: 'float',
    min: 'nearest',
    max: 'nearest',
    wrap: 'repeat'
  })

  // TODO: so is this 4x4 or 8x8? (it's 64 floats, but was w=4 h=4)
  this.ssaoNoiseMap = regl.texture({
    data: ssaoNoiseData,
    width: 8,
    height: 8,
    type: 'float',
    min: 'nearest',
    max: 'nearest',
    wrap: 'repeat'
  })
}

Renderer.prototype.initSkybox = function () {
  var regl = this._regl
  this._skyEnvMapTex = new SkyEnvMap(regl, State.sunPosition)
  this._skybox = new Skybox(regl, this._skyEnvMapTex.getTexture())
  this._reflectionProbe = new ReflectionProbe(regl, [0, 0, 0])

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
  var regl = this._regl
  if (!data.position) data.position = [0, 0, 0]
  if (!data.scale) data.scale = [1, 1, 1]
  if (!data.rotation) data.rotation = [0, 0, 0, 1]

  if (data.enabled === undefined) data.enabled = true
  data._parent = null
  data._children = []
  data._localTransform = Mat4.create()
  data._globalTransform = Mat4.create()
  data._prevPosition = Vec3.copy(data.position)

  if (data.mesh || data.vertexArray) {
    var material = data.material
    if (!material) { material = data.material = {} }
    if (!material.baseColorMap && (material.baseColor === undefined)) { material.baseColor = [0.95, 0.95, 0.95, 1] }
    if (!material.emissiveColorMap && (material.emissiveColor === undefined)) { material.emissiveColor = [0.0, 0.0, 0.0, 1] }
    if (!material.metallicMap && (material.metallic === undefined)) { material.metallic = 0.0 }
    if (!material.roughnessMap && (material.roughness === undefined)) { material.roughness = 0.5 }
    if (!material._uniforms) { material._uniforms = {}}

    // TODO: don't create mesh draw commands every frame
    // data._drawCommand = cmdQueue.createDrawCommand({
      // mesh: data.mesh,
			// vertexArray: data.vertexArray,
			// count: data.count,
			// primitiveType: data.primitiveType,
      // program: null,
      // uniforms: material._uniforms,
      // lineWidth: material.lineWidth,
      // depthTest: true,
      // cullFace: true,
      // cullFaceMode: ctx.BACK
    // })
  }
  if (data.light) {
    var light = data.light
    if (light.type === 'directional') {
      if (light.shadows === undefined) { light.shadows = true }
      if (light.color === undefined) { light.color = [1, 1, 1, 1] }
      if (light.direction === undefined) { light.direction = [0, -1, 0] }

      // TODO: continue here

      light._colorMap = regl.texture({ width: 1024, height: 1024 }) // FIXME: remove light color map
      light._shadowMap = regl.texture({ width: 1024, height: 1024, format: 'depth stencil', type: 'depth stencil' })
      light._shadowFbo = regl.framebuffer({
        color: [light._colorMap],
        depthStencil: light._shadowMap
      })

      light._shadowMapDrawCommand = regl({
        framebuffer: light._shadowFbo,
        viewport: { x: 0, y: 0, width: 1024, height: 1024 }
      })
      light._viewMatrix = Mat4.create()
      light._projectionMatrix = Mat4.create()
      light._prevDirection = [0, 0, 0]
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
  var regl = this._regl
  var light = lightNode.data.light

  var target = Vec3.copy(lightNode.data.position)
  Vec3.add(target, light.direction)
  Mat4.lookAt(light._viewMatrix, lightNode.data.position, target, [0, 1, 0])
  Mat4.ortho(light._projectionMatrix, light._left, light._right, light._bottom, light._top, light._near, light._far)

  light._shadowMapDrawCommand(function (context) {
    regl.clear({
      color: [0, 0, 0, 1],
      depth: 1
    })
    this.drawMeshes(light)
  }.bind(this))
}

var Vert = fs.readFileSync(__dirname + '/glsl/PBR.vert', 'utf8')
var Frag = fs.readFileSync(__dirname + '/glsl/PBR.frag', 'utf8')

// TODO: how fast is building these flag strings every frame for every object?
Renderer.prototype.getMeshProgram = function (meshMaterial, options) {
  // var ctx = this._ctx

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
  // var hash = vertSrc + fragSrc

  return {
    vert: vertSrc,
    frag: fragSrc
  }
}

Renderer.prototype.updateNodeLists = function () {
  this._cameraNodes = this.getNodes('camera')
  // TODO: reimplement node.enabled filtering
  this._meshNodes = this.getNodes('mesh')
		.concat(this.getNodes('attributes'))
		// .filter(function (node) { return node.data.enabled })
  console.log('updateNodesList meshNodes', this._meshNodes.length)
  this._lightNodes = this.getNodes('light').filter(function (node) { return node.data.enabled })
  this._directionalLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'directional'})
  this._pointLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'point'})
  this._areaLightNodes = this._lightNodes.filter(function (node) { return node.data.light.type === 'area'})
}

// From @toji's gl-matrix, pulled out to save some time :')
// http://glmatrix.net/docs/mat4.html#.fromRotationTranslationScale
function fromRotationTranslationScale (out, q, v, s) {
  var x = q[0], y = q[1], z = q[2], w = q[3],
    x2 = x + x,
    y2 = y + y,
    z2 = z + z,

    xx = x * x2,
    xy = x * y2,
    xz = x * z2,
    yy = y * y2,
    yz = y * z2,
    zz = z * z2,
    wx = w * x2,
    wy = w * y2,
    wz = w * z2,
    sx = s[0],
    sy = s[1],
    sz = s[2]

  out[0] = (1 - (yy + zz)) * sx
  out[1] = (xy + wz) * sx
  out[2] = (xz - wy) * sx
  out[3] = 0
  out[4] = (xy - wz) * sy
  out[5] = (1 - (xx + zz)) * sy
  out[6] = (yz + wx) * sy
  out[7] = 0
  out[8] = (xz + wy) * sz
  out[9] = (yz - wx) * sz
  out[10] = (1 - (xx + yy)) * sz
  out[11] = 0
  out[12] = v[0]
  out[13] = v[1]
  out[14] = v[2]
  out[15] = 1

  return out
}
// sort meshes by material
// do material search by props not string concat
// set global uniforms like lights once
// set update transforms once per frame
// draw + shadowmap @ 1000 objects x 30 uniforms = 60'000 setters / frame!!
// transform feedback?
Renderer.prototype.drawMeshes = function (shadowMappingLight) {
  // var ctx = this._ctx
  // var cmdQueue = this._cmdQueue

  // if (State.profile) ctx.getGL().finish()
  if (State.profile) console.time('Renderer:drawMeshes')

  var cameraNodes = this._cameraNodes
  var meshNodes = this._meshNodes
  var directionalLightNodes = this._directionalLightNodes
  var pointLightNodes = this._pointLightNodes
  var areaLightNodes = this._areaLightNodes
  var camera = cameraNodes[0].data.camera

  var sharedUniforms = this._sharedUniforms = this._sharedUniforms || {}
  sharedUniforms.uReflectionMap = this._reflectionProbe.getReflectionMap()
  sharedUniforms.uIrradianceMap = this._reflectionProbe.getIrradianceMap()
  sharedUniforms.uReflectionMapFlipEnvMap = 1 // TODO: this._reflectionProbe.getReflectionMap().getFlipEnvMap ? this._reflectionProbe.getReflectionMap().getFlipEnvMap() : -1
  sharedUniforms.uIrradianceMapFlipEnvMap = 1 // TODO: this._reflectionProbe.getIrradianceMap().getFlipEnvMap ? this._reflectionProbe.getIrradianceMap().getFlipEnvMap() : -1
  sharedUniforms.uCameraPosition = cameraNodes[0].data.camera.getPosition()

  if (!this.areaLightTextures) {
    // this.ltc_mat_texture = ctx.createTexture2D(new Float32Array(AreaLightsData.mat), 64, 64, { type: ctx.FLOAT, flipY: false })
    // this.ltc_mag_texture = ctx.createTexture2D(new Float32Array(AreaLightsData.mag), 64, 64, { type: ctx.FLOAT, format: ctx.getGL().ALPHA, flipY: false })
    // this.areaLightTextures = true
  }
  // sharedUniforms.ltc_mat = this.ltc_mat_texture
  // sharedUniforms.ltc_mag = this.ltc_mag_texture

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
    // var light = lightNode.data.light
    // sharedUniforms['uPointLights[' + i + '].position'] = lightNode.data.position
    // sharedUniforms['uPointLights[' + i + '].color'] = light.color
    // sharedUniforms['uPointLights[' + i + '].radius'] = light.radius
  })

  areaLightNodes.forEach(function (lightNode, i) {
    // var light = lightNode.data.light
    // sharedUniforms['uAreaLights[' + i + '].position'] = lightNode.data.position
    // sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    // sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity
    // sharedUniforms['uAreaLights[' + i + '].rotation'] = lightNode.data.rotation
    // sharedUniforms['uAreaLights[' + i + '].size'] = [lightNode.data.scale[0] / 2, lightNode.data.scale[1] / 2]
  })

  var viewMatrix
  var inverseViewMatrix
  var projectionMatrix
  if (shadowMappingLight) {
    projectionMatrix = shadowMappingLight._projectionMatrix
    viewMatrix = shadowMappingLight._viewMatrix
    inverseViewMatrix = Mat4.invert(Mat4.set(Mat4.create(), viewMatrix)) // FIXME: invViewMat allocation
  } else {
    projectionMatrix = camera.getProjectionMatrix()
    viewMatrix = camera.getViewMatrix()
    inverseViewMatrix = Mat4.invert(Mat4.set(Mat4.create(), viewMatrix)) // FIXME: invViewMat allocation
  }

  // var prevProgram = null
  for (var i = 0; i < meshNodes.length; i++) {
    var meshNode = meshNodes[i]
    var material = meshNode.data.material
    var cachedUniforms = material._uniforms
    cachedUniforms.uIor = 1.4
    cachedUniforms.uBaseColor = material.baseColor
    // cachedUniforms.uBaseColorMap = material.baseColorMap
    cachedUniforms.uEmissiveColor = material.emissiveColor
    // cachedUniforms.uEmissiveColorMap = material.emissiveColorMap
    cachedUniforms.uMetallic = material.metallic || 0.1
    // cachedUniforms.uMetallicMap = material.metallicMap
    cachedUniforms.uRoughness = material.roughness || 1
    // cachedUniforms.uRoughnessMap = material.roughnessMap
    // cachedUniforms.uNormalMap = material.normalMap

    if (material.uniforms) {
      for (var uniformName in material.uniforms) {
        cachedUniforms[uniformName] = material.uniforms[uniformName]
      }
    }

    // if (meshProgram !== prevProgram) {
      // prevProgram = meshProgram
      // this is a bit hacky but prevents checking the same uniforms over and over again
      // this would be even better if we sort meshes by material
      // Object.assign(cachedUniforms, sharedUniforms)
    // }
    var tmpNormalMat = Mat4.create()
    var data = meshNode.data
    if (!data._drawCommand) {
      var regl = this._regl
      var meshProgram = this.getMeshProgram(material, {
        numDirectionalLights: directionalLightNodes.length,
        // numPointLights: pointLightNodes.length,
        // numAreaLights: areaLightNodes.length,
        useReflectionProbes: true
      })
      var cmdData = {
        attributes: {
          aPosition: regl.buffer(data.mesh.positions),
          aNormal: regl.buffer(data.mesh.normals || data.mesh.positions),
          aTexCoord0: regl.buffer(data.mesh.uvs || data.mesh.positions)
        },
        primitive: data.primitive || 'triangles',
        // elements: regl.elements(data.mesh.cells),
        vert: meshProgram.vert,
        frag: meshProgram.frag,
        // depth: {
          // enable: true
        // },
        uniforms: Object.assign({
          uColor: material.baseColor,
          uModelMatrix: regl.prop('modelMatrix'),
          uNormalMatrix: regl.prop('normalMatrix'),
          uProjectionMatrix: regl.context('projectionMatrix'),
          uViewMatrix: regl.context('viewMatrix'),
          uInverseViewMatrix: regl.context('inverseViewMatrix')
        }, cachedUniforms, sharedUniforms)
        // mesh: data.mesh,
        // vertexArray: data.vertexArray,
        // count: data.count,
        // primitiveType: data.primitiveType,
        // program: null,
        // uniforms: material._uniforms,
        // lineWidth: material.lineWidth,
        // depthTest: true,
        // cullFace: true,
        // cullFaceMode: ctx.BACK
      }
      if (data.batch) {
        cmdData.uniforms.uModelMatrix = function (context, props) {
          // FIXME: can i cache is somehow? Maybe just pass modelMatrix directly?
          return fromRotationTranslationScale(Mat4.create(), [0, 0, 0, 1], props.position, props.scale)
          // var m = Mat4.create()
          // Mat4.translate(m, props.position)
          // Mat4.scale(m, props.scale)
          // // TODO: add rotation
          // return m
        }
        cmdData.uniforms.uNormalMatrix = function (context, props, batchId) {
          var modelMatrix = fromRotationTranslationScale(Mat4.create(), [0, 0, 0, 1], props.position, props.scale)
          // FIXME: can i cache is somehow? Maybe just pass modelMatrix directly?
          // var modelMatrix = Mat4.create()
          // Mat4.translate(modelMatrix, props.position)
          // Mat4.scale(modelMatrix, props.scale)
          Mat4.set(tmpNormalMat, context.viewMatrix)
          Mat4.mult(tmpNormalMat, modelMatrix)
          Mat4.invert(tmpNormalMat)
          Mat4.transpose(tmpNormalMat)
          return Mat3.fromMat4(Mat3.create(), tmpNormalMat)
        }
      }
      if (data.mesh.cells) {
        cmdData.elements = regl.elements(data.mesh.cells)
      } else {
        cmdData.count = data.mesh.positions.length
      }
      data._drawCommand = regl(cmdData)
    }

    meshNode.data._drawCommand.modelMatrix = meshNode.modelMatrix
    meshNode.data._drawCommand.program = meshProgram

    // cmdQueue.submit(meshNode.data._drawCommand)

    // FIXME: this should happen only once
    this._setupCameraCommand({
      projectionMatrix: projectionMatrix,
      viewMatrix: viewMatrix,
      inverseViewMatrix: inverseViewMatrix
    }, function () {
      // FIXME: what is scene-graph normalMatrix? Can i compute the right one in the shader?
      Mat4.set(tmpNormalMat, viewMatrix)
      Mat4.mult(tmpNormalMat, meshNode.modelMatrix)
      Mat4.invert(tmpNormalMat)
      Mat4.transpose(tmpNormalMat)
      Mat3.fromMat4(meshNode.normalMatrix, tmpNormalMat)
      meshNode.data._drawCommand(meshNode.data.batch || {
        modelMatrix: meshNode.modelMatrix,
        normalMatrix: meshNode.normalMatrix
     })
    })

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

  // if (State.profile) ctx.getGL().finish()
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
  var regl = this._regl

  regl.clear({
    color: [0.2, 0.2, 0.2, 1],
    depth: 1,
    stencil: 0
  })

  this._root.tick()
  if (this._root.sortVersion !== this._rootPrevSortVersion) {
    this.updateNodeLists()
    this._rootPrevSortVersion = this._root.sortVersion
  }

  // REGL cmdQueue.submit(this._clearCommand) // FIXME: unnecesary?

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
    // REGL
    this._skyEnvMapTex.setSunPosition(State.sunPosition)
    this._skybox.setEnvMap(State.skyEnvMap || this._skyEnvMapTex.getTexture())
    this._reflectionProbe.update(function () {
      this._skybox.draw()
    }.bind(this))
  }

  var currentCamera = cameraNodes[0].data.camera

  // draw scene
  if (!this._setupCameraCommand) {
    this._setupCameraCommand = regl({
      context: {
        projectionMatrix: regl.prop('projectionMatrix'),
        viewMatrix: regl.prop('viewMatrix'),
        inverseViewMatrix: regl.prop('inverseViewMatrix')
      }
    })
  }

  // REGL
  directionalLightNodes.forEach(function (lightNode) {
    var light = lightNode.data.light
    var positionHasChanged = !Vec3.equals(lightNode.data.position, lightNode.data._prevPosition)
    var directionHasChanged = !Vec3.equals(light.direction, light._prevDirection)
    if (positionHasChanged || directionHasChanged) {
      Vec3.set(lightNode.data._prevPosition, lightNode.data.position)
      Vec3.set(light._prevDirection, light.direction)
      this.updateDirectionalLightShadowMap(lightNode)
    }
  }.bind(this))

  this._drawFrameFboCommand(function (context) {
    regl.clear({
      color: [1, 1, 0, 1],
      depth: 1
    })
    // FIXME: share that context with mesh draw
    var currentCamera = this._cameraNodes[0].data.camera
    this._setupCameraCommand({
      projectionMatrix: currentCamera.getProjectionMatrix(),
      viewMatrix: currentCamera.getViewMatrix()
    }, function () {
      this._skybox.draw()
    }.bind(this))
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
  }.bind(this))

  // var W = this._width
  // var H = this._height

  var root = this._fx.reset()
  var color = root.asFXStage(this._frameColorTex, 'img')
  if (directionalLightNodes[0].data.light) {
    // color = root.asFXStage(directionalLightNodes[0].data.light._colorMap, 'img')
  }
  var final = color

  // if (State.profile) ctx.getGL().finish()
  // if (State.profile) console.time('Renderer:postprocessing')
  // if (State.profile) console.time('Renderer:ssao')
  if (State.ssao) {
    var ssao = root.ssao({
      depthMap: this._frameDepthTex,
      normalMap: this._frameNormalTex,
      kernelMap: this.ssaoKernelMap,
      noiseMap: this.ssaoNoiseMap,
      camera: currentCamera,
      width: this._width / State.ssaoDownsample,
      height: this._height / State.ssaoDownsample,
      radius: State.ssaoRadius
    })
    ssao = ssao.bilateralBlur({ depthMap: this._frameDepthTex, camera: currentCamera, sharpness: State.ssaoSharpness })
    // TODO: this is incorrect, AO influences only indirect diffuse (irradiance) and indirect specular reflections
    // this will also influence direct lighting (lights, sun)
    final = color.mult(ssao, { bpp: 16 })
  }
  // if (State.profile) ctx.getGL().finish()
  // if (State.profile) console.timeEnd('Renderer:ssao')

  // if (State.profile) console.time('Renderer:postprocess')
  final = final.postprocess({ exposure: State.exposure })
  // if (State.profile) ctx.getGL().finish()
  // if (State.profile) console.timeEnd('Renderer:postprocess')

  // if (State.profile) console.time('Renderer:fxaa')
  if (State.fxaa) {
    final = final.fxaa()
  }
  // if (State.profile) ctx.getGL().finish()
  // if (State.profile) console.timeEnd('Renderer:fxaa')
  // if (State.profile) ctx.getGL().finish()
  // if (State.profile) console.timeEnd('Renderer:postprocessing')
  // var viewport = ctx.getViewport()
  // // final = ssao
  final.blit({ x: 0, y: 0, width: this._width, height: this._height })

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

  // if (State.debug) {
    // // this.drawDebug()
  // }

  // cmdQueue.flush()
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
