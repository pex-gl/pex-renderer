const Vec3 = require('pex-math/Vec3')
const Vec4 = require('pex-math/Vec4')
const Mat3 = require('pex-math/Mat3')
const Mat4 = require('pex-math/Mat4')
// var Draw = require('pex-draw/Draw')
// var fx = require('pex-fx')
const glsl = require('glslify')
// const AreaLightsData = require('./AreaLightsData')
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
const createSpotLight = require('./spot-light')
const createAreaLight = require('./area-light')
const createReflectionProbe = require('./reflection-probe')
const createSkybox = require('./skybox')
const path = require('path')

// pex-fx extensions, extending FXStage
// require('./Postprocess')
// require('./BilateralBlur')
// require('./SSAO')

const DEPTH_PASS_VERT = glsl(path.join(__dirname, 'glsl/DepthPass.vert'))
const DEPTH_PASS_FRAG = glsl(path.join(__dirname, 'glsl/DepthPass.frag'))
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_FRAG = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8')
// var SHOW_COLORS_VERT = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8')
// var SHOW_COLORS_FRAG = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8')

var State = {
  frame: 0,
  shadowQuality: 2,
  debug: false,
  profile: false,
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

  // TODO: move from State object to internal probs and renderer({ opts }) setter?
  Object.assign(State, opts)
  this._state = State
}

Renderer.prototype.updateDirectionalLightShadowMap = function (light, geometries) {
  const ctx = this._ctx
  const position = [0, 0, 0]
  Vec3.scale(position, 0)
  Vec3.sub(position, light.direction)
  Vec3.normalize(position)
  Vec3.scale(position, 7.5)
  const target = Vec3.copy(position)
  Vec3.add(target, light.direction)
  Mat4.lookAt(light._viewMatrix, position, target, [0, 1, 0])
  Mat4.ortho(light._projectionMatrix, light._left, light._right, light._bottom, light._top, light._near, light._far)

  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(null, light, geometries)
  })
}

var PBRVert = glsl(path.join(__dirname, 'glsl/PBR.vert'))
var PBRFrag = glsl(path.join(__dirname, 'glsl/PBR.frag'))

// TODO: how fast is building these flag strings every frame for every object?
Renderer.prototype.getMaterialProgram = function (geometry, material, skin, options) {
  var ctx = this._ctx

  if (!this._programCache) {
    this._programCache = {}
  }

  var flags = []

  if (geometry._attributes.aNormal) {
    flags.push('#define USE_NORMALS')
  }
  if (geometry._attributes.aTexCoord0) {
    flags.push('#define USE_TEX_COORDS')
  }
  if (geometry._attributes.aOffset) {
    flags.push('#define USE_INSTANCED_OFFSET')
  }
  if (geometry._attributes.aScale) {
    flags.push('#define USE_INSTANCED_SCALE')
  }
  if (geometry._attributes.aRotation) {
    flags.push('#define USE_INSTANCED_ROTATION')
  }
  if (options.useSSAO) {
    flags.push('#define USE_AO')
  }
  if (material.displacementMap) {
    flags.push('#define USE_DISPLACEMENT_MAP')
  }
  if (skin) {
    flags.push('#define USE_SKIN')
    flags.push('#define NUM_JOINTS ' + skin.joints.length)
  }

  if (options.depthPassOnly) {
    const hash = 'DEPTH_PASS_ONLY_' + flags.join('-')
    let program = this._programCache[hash]
    flags = flags.join('\n') + '\n'
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

  flags.push('#define SHADOW_QUALITY ' + (material.receiveShadows ? State.shadowQuality : 0))

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
  if (material.emissiveColorMap) {
    flags.push('#define USE_EMISSIVE_COLOR_MAP')
  }
  flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (options.numDirectionalLights || 0))
  flags.push('#define NUM_POINT_LIGHTS ' + (options.numPointLights || 0))
  flags.push('#define NUM_SPOT_LIGHTS ' + (options.numSpotLights || 0))
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
  if (!transform.enabled) return
  beforeCallback(transform)
  transform.children.forEach((child) => {
    this.traverseTransformTree(child, beforeCallback, afterCallback)
  })
  if (afterCallback) afterCallback(transform)
}

Renderer.prototype.update = function () {
  this.entities = []
  this.traverseTransformTree(
    this.root.transform,
    (transform) => {
      this.entities.push(transform.entity)
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
  const hash = material.id + '_' + program.id
  let pipeline = this._pipelineCache[hash]
  if (!pipeline) {
    pipeline = ctx.pipeline({
      program: program,
      depthTest: material.depthTest,
      depthWrite: material.depthWrite,
      depthFunc: material.depthFunc,
      blendEnabled: material.blendEnabled,
      blendSrcRGBFactor: material.blendSrcRGBFactor,
      blendSrcAlphaFactor: material.blendSrcAlphaFactor,
      blendDstRGBFactor: material.blendDstRGBFactor,
      blendDstAlphaFactor: material.blendDstAlphaFactor,
      cullFaceEnabled: true,
      cullFace: ctx.Face.Back,
      primitive: geometry.primitive
    })
    this._pipelineCache[hash] = pipeline
  }

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
Renderer.prototype.drawMeshes = function (camera, shadowMappingLight, geometries) {
  const ctx = this._ctx

  if (State.profiler) State.profiler.time('drawMeshes')

  function byCameraTags (component) {
    if (!camera) return true
    if (!camera.entity.tags.length) return true
    if (!component.entity.tags.length) return true
    return component.entity.tags[0] === camera.entity.tags[0]
  }

  geometries = geometries || this.getComponents('Geometry').filter(byCameraTags)
  const directionalLights = this.getComponents('DirectionalLight').filter(byCameraTags)
  const pointLights = this.getComponents('PointLight').filter(byCameraTags)
  const spotLights = this.getComponents('SpotLight').filter(byCameraTags)
  const areaLights = this.getComponents('AreaLight').filter(byCameraTags)
  const reflectionProbes = this.getComponents('ReflectionProbe').filter(byCameraTags)

  var sharedUniforms = this._sharedUniforms = this._sharedUniforms || {}
  sharedUniforms.uOutputEncoding = State.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear // TODO: State.postprocess

  if (!shadowMappingLight) {
    directionalLights.forEach((light) => {
      Vec3.set(light._prevDirection, light.direction)
      if (light.castShadows) {
        const shadowCasters = geometries.filter((geometry) => {
          const material = geometry.entity.getComponent('Material')
          return material && material.castShadows
        })
        this.updateDirectionalLightShadowMap(light, shadowCasters)
      }
    })
  }

  // TODO:  find nearest reflection probe
  if (reflectionProbes.length > 0) {
    sharedUniforms.uReflectionMap = reflectionProbes[0]._reflectionMap
    sharedUniforms.uReflectionMapEncoding = reflectionProbes[0]._reflectionMap.encoding
  }
  if (shadowMappingLight) {
    sharedUniforms.uProjectionMatrix = shadowMappingLight._projectionMatrix
    sharedUniforms.uViewMatrix = shadowMappingLight._viewMatrix
  } else {
    sharedUniforms.uCameraPosition = camera.position
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix
    sharedUniforms.uViewMatrix = camera.viewMatrix
    sharedUniforms.uInverseViewMatrix = Mat4.invert(Mat4.copy(camera.viewMatrix))
  }

  if (camera && camera.ssao) {
    sharedUniforms.uAO = camera._frameAOTex
    sharedUniforms.uScreenSize = [ this._width, this._height ] // TODO: should this be camera viewport size?
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

  spotLights.forEach(function (light, i) {
    sharedUniforms['uSpotLights[' + i + '].position'] = light.entity.transform.position
    sharedUniforms['uSpotLights[' + i + '].color'] = light.color
    sharedUniforms['uSpotLights[' + i + '].distance'] = light.distance
    sharedUniforms['uSpotLights[' + i + '].angle'] = light.angle
    sharedUniforms['uSpotLights[' + i + '].direction'] = light.direction
  })

  areaLights.forEach(function (light, i) {
    sharedUniforms.ltc_mat = light.ltc_mat_texture
    sharedUniforms.ltc_mag = light.ltc_mag_texture
    sharedUniforms['uAreaLights[' + i + '].position'] = light.entity.transform.position
    sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity // FIXME: why area light has intensity and other lights don't?
    sharedUniforms['uAreaLights[' + i + '].rotation'] = light.entity.transform.rotation
    sharedUniforms['uAreaLights[' + i + '].size'] = [light.entity.transform.scale[0] / 2, light.entity.transform.scale[1] / 2]
  })

  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i]
    const transform = geometry.entity.transform
    if (!transform.enabled) continue
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
    if (material.displacementMap) {
      cachedUniforms.uDisplacementMap = material.displacementMap
      cachedUniforms.uDisplacement = material.displacement
      cachedUniforms.uDisplacementNormalScale = material.displacementNormalScale
    }

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
        numSpotLights: spotLights.length,
        numAreaLights: areaLights.length,
        useReflectionProbes: reflectionProbes.length, // TODO: reflection probes true
        useSSAO: camera.ssao
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
      count: geometry.count,
      pipeline: pipeline,
      uniforms: cachedUniforms,
      instances: geometry.instances
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
      probe.update((camera, encoding) => {
        if (skyboxes.length > 0) {
          skyboxes[0].draw(camera, { outputEncoding: encoding })
        }
      })
    }
  })

  // draw scene

  cameras.forEach((camera, cameraIndex) => {
    ctx.submit(camera._drawFrameFboCommand, () => {
      // depth prepass
      if (camera.depthPrepass) {
        ctx.gl.colorMask(0, 0, 0, 0)
        this.drawMeshes(camera)
        ctx.gl.colorMask(1, 1, 1, 1)
      }
      this.drawMeshes(camera)
      if (skyboxes.length > 0) {
        skyboxes[0].draw(camera, { outputEncoding: camera._frameColorTex.encoding })
      }
    })
    if (camera.ssao) {
      ctx.submit(camera._ssaoCmd, {
        uniforms: {
          uNear: camera.camera.near,
          uFar: camera.camera.far,
          uFov: camera.camera.fov,
          viewMatrix: camera.camera.viewMatrix,
          uInverseViewMatrix: Mat4.invert(Mat4.copy(camera.camera.viewMatrix)),
          viewProjectionInverseMatrix: Mat4.invert(Mat4.mult(Mat4.copy(camera.camera.viewMatrix), camera.camera.projectionMatrix)),
          cameraPositionWorldSpace: camera.camera.position,
          uIntensity: camera.ssaoIntensity,
          uNoiseScale: [10, 10],
          uSampleRadiusWS: camera.ssaoRadius,
          uBias: camera.ssaoBias
        }
      })
    }
    if (camera.ssao && camera.bilateralBlur) {
      ctx.submit(camera._bilateralBlurHCmd, {
        uniforms: {
          near: camera.camera.near,
          far: camera.camera.far,
          sharpness: 1,
          imageSize: [this._width, this._height],
          direction: [camera.bilateralBlurRadius, 0]
        }
      })
      ctx.submit(camera._bilateralBlurVCmd, {
        uniforms: {
          near: camera.camera.near,
          far: camera.camera.far,
          sharpness: 1,
          imageSize: [this._width, this._height],
          direction: [0, camera.bilateralBlurRadius]
        }
      })
    }
    if (camera.dof) {
      for (var i = 0; i < camera.dofIterations; i++) {
        ctx.submit(camera._dofBlurHCmd, {
          uniforms: {
            near: camera.camera.near,
            far: camera.camera.far,
            sharpness: 1,
            imageSize: [this._width, this._height],
            direction: [camera.dofRadius, 0],
            uDOFDepth: camera.dofDepth,
            uDOFRange: camera.dofRange
          }
        })
        ctx.submit(camera._dofBlurVCmd, {
          uniforms: {
            near: camera.camera.near,
            far: camera.camera.far,
            sharpness: 1,
            imageSize: [this._width, this._height],
            direction: [0, camera.dofRadius],
            uDOFDepth: camera.dofDepth,
            uDOFRange: camera.dofRange
          }
        })
      }
    }
    ctx.submit(camera._blitCmd, {
      uniforms: {
        uExposure: camera.exposure,
        uFXAA: camera.fxaa,
        uFog: camera.fog,
        uOutputEncoding: ctx.Encoding.Gamma,
        uNear: camera.camera.near,
        uFar: camera.camera.far,
        uFov: camera.camera.fov,
        uSunDispertion: camera.sunDispertion,
        uSunIntensity: camera.sunIntensity,
        uInscatteringCoeffs: camera.inscatteringCoeffs,
        uFogColor: camera.fogColor,
        uFogStart: camera.fogStart,
        uFogDensity: camera.fogDensity,
        uSunPosition: camera.sunPosition
      },
      viewport: camera.viewport
    })
  })

  /*
  if (State.postprocess) {
    ctx.submit(this._drawFramePrepassFboCmd, () => {
      if (State.depthPrepass) {
        ctx.gl.colorMask(0, 0, 0, 0)
        this.drawMeshes()
        ctx.gl.colorMask(1, 1, 1, 1)
      }
    })
  } else {
    if (State.depthPrepass) {
      ctx.submit(this._drawFramePrepassFboCmd, () => {
        if (State.depthPrepass) {
          ctx.gl.colorMask(0, 0, 0, 0)
          this.drawMeshes()
          ctx.gl.colorMask(1, 1, 1, 1)
        }
      })
      ctx.gl.colorMask(0, 0, 0, 0)
      this.drawMeshes()
      ctx.gl.colorMask(1, 1, 1, 1)
    }
  }
  */
  /*
  if (State.postprocess) {
    ctx.submit(this._drawFrameFboCmd, () => {
      this.drawMeshes()

      if (skyboxes.length > 0) {
        skyboxes[0].draw(currentCamera, { rgbm: true })
      }
    })
    ctx.submit(this._blitCmd, {
      uniforms: {
        uExposure: State.exposure
      }
    })
  } else {
    this.drawMeshes()

    if (skyboxes.length > 0) {
      skyboxes[0].draw(currentCamera, { rgbm: false })
    }
  }
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

Renderer.prototype.entity = function (components, tags) {
  return createEntity(components, tags)
}

Renderer.prototype.add = function (entity, parent) {
  entity.transform.set({
    parent: parent ? parent.tranform : entity.transform.parent || this.root.transform
  })
}

Renderer.prototype.remove = function (entity) {
  entity.transform.set({ parent: null })
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
  return createCamera(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
}

Renderer.prototype.directionalLight = function (opts) {
  return createDirectionalLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.pointLight = function (opts) {
  return createPointLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.spotLight = function (opts) {
  return createSpotLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.areaLight = function (opts) {
  return createAreaLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.reflectionProbe = function (opts) {
  return createReflectionProbe(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
}

Renderer.prototype.skybox = function (opts) {
  return createSkybox(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
}

module.exports = function createRenderer (opts) {
  return new Renderer(opts)
}
