const vec3 = require('pex-math/vec3')
const vec4 = require('pex-math/vec4')
const mat3 = require('pex-math/mat3')
const mat4 = require('pex-math/mat4')
const aabb = require('pex-geom/aabb')
const createProfiler = require('./profiler')
const isBrowser = require('is-browser')
const createEntity = require('./entity')
const createTransform = require('./transform')
const createSkin = require('./skin')
const createMorph = require('./morph')
const createAnimation = require('./animation')
const createGeometry = require('./geometry')
const createMaterial = require('./material')
const createCamera = require('./camera')
const createOrbiter = require('./orbiter')
const createAmbientLight = require('./ambient-light')
const createDirectionalLight = require('./directional-light')
const createPointLight = require('./point-light')
const createSpotLight = require('./spot-light')
const createAreaLight = require('./area-light')
const createReflectionProbe = require('./reflection-probe')
const createSkybox = require('./skybox')
const createOverlay = require('./overlay')

const PBR_VERT = require('./shaders/pipeline/material.vert.js')
const PBR_FRAG = require('./shaders/pipeline/material.frag.js')
const DEPTH_PASS_VERT = require('./shaders/pipeline/depth-pass.vert.js')
const DEPTH_PASS_FRAG = require('./shaders/pipeline/depth-pass.frag.js')
const DEPTH_PRE_PASS_FRAG = require('./shaders/pipeline/depth-pre-pass.frag.js')
const OVERLAY_VERT = require('./shaders/pipeline/overlay.vert.js')
const OVERLAY_FRAG = require('./shaders/pipeline/overlay.frag.js')
const ERROR_VERT = require('./shaders/error/error.vert.js')
const ERROR_FRAG = require('./shaders/error/error.frag.js')
const SHADERS_CHUNKS = require('./shaders/chunks')

var State = {
  frame: 0,
  shadowQuality: 2,
  debug: false,
  profile: false,
  profiler: null,
  paused: false
}

function isNil (x) {
  return x == null
}

// TODO remove, should be in AABB
function aabbToPoints (bbox) {
  if (aabb.isEmpty(bbox)) return []
  return [
    [bbox[0][0], bbox[0][1], bbox[0][2], 1],
    [bbox[1][0], bbox[0][1], bbox[0][2], 1],
    [bbox[1][0], bbox[0][1], bbox[1][2], 1],
    [bbox[0][0], bbox[0][1], bbox[1][2], 1],
    [bbox[0][0], bbox[1][1], bbox[0][2], 1],
    [bbox[1][0], bbox[1][1], bbox[0][2], 1],
    [bbox[1][0], bbox[1][1], bbox[1][2], 1],
    [bbox[0][0], bbox[1][1], bbox[1][2], 1]
  ]
}

// opts = Context
// opts = { ctx: Context, width: Number, height: Number, profile: Boolean }
function Renderer (opts) {
  this.entities = []
  this.root = this.entity()

  // check if we passed gl context or options object
  opts = opts.texture2D ? { ctx: opts } : opts

  this._ctx = opts.ctx

  const gl = opts.ctx.gl
  gl.getExtension('OES_standard_derivatives')

  this._debug = false
  this._programCacheMap = {
    values: [],
    getValue: function (flags, vert, frag) {
      for (var i = 0; i < this.values.length; i++) {
        var v = this.values[i]
        if (v.frag === frag && v.vert === vert) {
          if (v.flags.length === flags.length) {
            var found = true
            for (var j = 0; j < flags.length; j++) {
              if (v.flags[j] !== flags[j]) {
                found = false
                break
              }
            }
            if (found) {
              return v.program
            }
          }
        }
      }
      return false
    },
    setValue: function (flags, vert, frag, program) {
      this.values.push({ flags, vert, frag, program })
    }
  }

  if (opts.profile) {
    State.profiler = createProfiler(opts.ctx, this)
    State.profiler.flush = opts.profileFlush
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

  this.shaders = {
    chunks: SHADERS_CHUNKS,
    pipeline: {
      material: {
        vert: PBR_VERT,
        frag: PBR_FRAG
      }
    }
  }
}

Renderer.prototype.updateDirectionalLightShadowMap = function (light, geometries) {
  const ctx = this._ctx
  const position = light.entity.transform.worldPosition
  const target = [0, 0, 1, 0]
  const up = [0, 1, 0, 0]
  vec4.multMat4(target, light.entity.transform.modelMatrix)
  vec3.add(target, position)
  vec4.multMat4(up, light.entity.transform.modelMatrix)
  mat4.lookAt(light._viewMatrix, position, target, up)

  const shadowBboxPoints = geometries.reduce((points, geometry) => {
    return points.concat(aabbToPoints(geometry.entity.transform.worldBounds))
  }, [])

  // TODO: gc vec3.copy, all the bounding box creation
  const bboxPointsInLightSpace = shadowBboxPoints.map((p) => vec3.multMat4(vec3.copy(p), light._viewMatrix))
  const sceneBboxInLightSpace = aabb.fromPoints(bboxPointsInLightSpace)

  const lightNear = -sceneBboxInLightSpace[1][2]
  const lightFar = -sceneBboxInLightSpace[0][2]

  light.set({
    _near: lightNear,
    _far: lightFar
  })

  mat4.ortho(light._projectionMatrix,
    sceneBboxInLightSpace[0][0], sceneBboxInLightSpace[1][0],
    sceneBboxInLightSpace[0][1], sceneBboxInLightSpace[1][1],
    lightNear, lightFar
  )

  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(null, true, light, geometries)
  })
}

Renderer.prototype.updatePointLightShadowMap = function (light, geometries) {
  const ctx = this._ctx
  light._sides.forEach((side) => {
    var target = [0, 0, 0]
    ctx.submit(side.drawPassCmd, () => {
      const position = light.entity.transform.worldPosition
      vec3.set(target, position)
      vec3.add(target, side.target)
      mat4.lookAt(side.viewMatrix, position, target, side.up)
      var sideLight = {
        _projectionMatrix: side.projectionMatrix,
        _viewMatrix: side.viewMatrix
      }
      this.drawMeshes(null, true, sideLight, geometries)
    })
  })
}

Renderer.prototype.getMaterialProgramAndFlags = function (geometry, material, skin, options) {
  var ctx = this._ctx

  var flags = []

  if (!geometry._attributes.aNormal) {
    flags.push('#define USE_UNLIT_WORKFLOW')
  } else {
    flags.push('#define USE_NORMALS')
  }
  if (geometry._attributes.aTangent) {
    flags.push('#define USE_TANGENTS')
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
  if (geometry._attributes.aColor) {
    flags.push('#define USE_INSTANCED_COLOR')
  }
  if (geometry._attributes.aVertexColor) {
    flags.push('#define USE_VERTEX_COLORS')
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
  if (ctx.capabilities.maxColorAttachments > 1) {
    flags.push('#define USE_DRAW_BUFFERS')
  }
  if (material.baseColorMap) {
    flags.push('#define USE_BASE_COLOR_MAP')
    if (!material.baseColor) {
      material.baseColor = [1, 1, 1, 1]
    }
  }
  if (material.alphaMap) {
    flags.push('#define USE_ALPHA_MAP')
  }
  if (material.alphaTest) {
    flags.push('#define USE_ALPHA_TEST')
  }

  if (options.depthPrePassOnly) {
    flags.push('#define DEPTH_PRE_PASS_ONLY')
    flags.push('#define SHADOW_QUALITY ' + (0))
    flags.push('#define NUM_AMBIENT_LIGHTS ' + (0))
    flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (0))
    flags.push('#define NUM_POINT_LIGHTS ' + (0))
    flags.push('#define NUM_SPOT_LIGHTS ' + (0))
    flags.push('#define NUM_AREA_LIGHTS ' + (0))
    return {
      flags: flags,
      vert: (material.vert || DEPTH_PASS_VERT),
      frag: (material.frag || DEPTH_PRE_PASS_FRAG)
    }
  }

  if (options.depthPassOnly) {
    flags.push('#define DEPTH_PASS_ONLY')
    flags.push('#define SHADOW_QUALITY ' + (0))
    flags.push('#define NUM_AMBIENT_LIGHTS ' + (0))
    flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (0))
    flags.push('#define NUM_POINT_LIGHTS ' + (0))
    flags.push('#define NUM_SPOT_LIGHTS ' + (0))
    flags.push('#define NUM_AREA_LIGHTS ' + (0))
    return {
      flags: flags,
      vert: (material.vert || DEPTH_PASS_VERT),
      frag: (material.frag || DEPTH_PASS_FRAG)
    }
  }

  flags.push('#define SHADOW_QUALITY ' + (material.receiveShadows ? State.shadowQuality : 0))

  var useSpecularGlossinessWorkflow = false

  if (material.metallicMap) {
    flags.push('#define USE_METALLIC_MAP')
  }
  if (material.roughnessMap) {
    flags.push('#define USE_ROUGHNESS_MAP')
  }
  if (material.metallicRoughnessMap) {
    flags.push('#define USE_METALLIC_ROUGHNESS_MAP')
  }
  if (material.diffuse) {
    useSpecularGlossinessWorkflow = true
  }
  if (material.specular) {
    useSpecularGlossinessWorkflow = true
  }
  if (material.glossiness !== undefined) {
    useSpecularGlossinessWorkflow = true
  }
  if (material.diffuseMap) {
    useSpecularGlossinessWorkflow = true
    flags.push('#define USE_DIFFUSE_MAP')
  }
  if (material.specularGlossinessMap) {
    useSpecularGlossinessWorkflow = true
    flags.push('#define USE_SPECULAR_GLOSSINESS_MAP')
  }
  if (material.occlusionMap) {
    flags.push('#define USE_OCCLUSION_MAP')
  }
  if (material.normalMap) {
    flags.push('#define USE_NORMAL_MAP')
  }
  if (material.emissiveColorMap) {
    flags.push('#define USE_EMISSIVE_COLOR_MAP')
    if (!material.emissiveColor) {
      material.emissiveColor = [1, 1, 1, 1]
    }
  }
  if (material.blend) {
    flags.push('#define USE_BLEND')
  }

  if (isNil(material.metallic) && isNil(material.roughness)) {
    if (flags.indexOf('#define USE_UNLIT_WORKFLOW') === -1) {
      flags.push('#define USE_UNLIT_WORKFLOW')
    }
  } else if (useSpecularGlossinessWorkflow) {
    flags.push('#define USE_SPECULAR_GLOSSINESS_WORKFLOW')
  } else {
    flags.push('#define USE_METALLIC_ROUGHNESS_WORKFLOW')
  }
  flags.push('#define NUM_AMBIENT_LIGHTS ' + (options.numAmbientLights || 0))
  flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + (options.numDirectionalLights || 0))
  flags.push('#define NUM_POINT_LIGHTS ' + (options.numPointLights || 0))
  flags.push('#define NUM_SPOT_LIGHTS ' + (options.numSpotLights || 0))
  flags.push('#define NUM_AREA_LIGHTS ' + (options.numAreaLights || 0))
  if (options.useReflectionProbes) {
    flags.push('#define USE_REFLECTION_PROBES')
  }
  if (options.useTonemapping) {
    flags.push('#define USE_TONEMAPPING')
  }
  return {
    flags: flags,
    vert: (material.vert || PBR_VERT),
    frag: (material.frag || PBR_FRAG)
  }
}

Renderer.prototype.buildProgram = function (vertSrc, fragSrc) {
  var ctx = this._ctx
  let program = null
  try {
    program = ctx.program({ vert: vertSrc, frag: fragSrc })
  } catch (e) {
    // console.log('pex-renderer glsl error', e)
    program = ctx.program({ vert: ERROR_VERT, frag: ERROR_FRAG })
  }
  return program
}

Renderer.prototype.getMaterialProgram = function (geometry, material, skin, options) {
  var { flags, vert, frag } = this.getMaterialProgramAndFlags(geometry, material, skin, options)
  var flagsStr = flags.join('\n') + '\n'
  var vertSrc = flagsStr + vert
  var fragSrc = flagsStr + frag
  var program = this._programCacheMap.getValue(flags, vert, frag)
  if (!program) {
    program = this.buildProgram(vertSrc, fragSrc)
    this._programCacheMap.setValue(flags, vert, frag, program)
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
      blend: material.blend,
      blendSrcRGBFactor: material.blendSrcRGBFactor,
      blendSrcAlphaFactor: material.blendSrcAlphaFactor,
      blendDstRGBFactor: material.blendDstRGBFactor,
      blendDstAlphaFactor: material.blendDstAlphaFactor,
      cullFace: material.cullFace,
      cullFaceMode: ctx.Face.Back,
      primitive: geometry.primitive
    })
    this._pipelineCache[hash] = pipeline
  }

  return pipeline
}

Renderer.prototype.getOverlayCommand = function () {
  const ctx = this._ctx
  if (!this._drawOverlayCmd) {
    const program = ctx.program({
      vert: OVERLAY_VERT,
      frag: OVERLAY_FRAG
    })
    this._drawOverlayCmd = {
      name: 'DrawOverlayCmd',
      attributes: {
        aPosition: ctx.vertexBuffer([[-1, -1], [1, -1], [1, 1], [-1, 1]]),
        aTexCoord0: ctx.vertexBuffer([[0, 0], [1, 0], [1, 1], [0, 1]])
      },
      indices: ctx.indexBuffer([[0, 1, 2], [0, 2, 3]]),
      pipeline: ctx.pipeline({
        program: program,
        depthTest: false,
        depthWrite: false,
        blend: true,
        blendSrcRGBFactor: ctx.BlendFactor.One,
        blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
        blendSrcAlphaFactor: ctx.BlendFactor.One,
        blendDstAlphaFactor: ctx.BlendFactor.OneMinusSrcAlpha,
        cullFace: true,
        cullFaceMode: ctx.Face.Back,
        primitive: ctx.Primitive.Triangles
      })
    }
  }

  return this._drawOverlayCmd
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
Renderer.prototype.drawMeshes = function (camera, shadowMapping, shadowMappingLight, geometries, skybox, forward) {
  const ctx = this._ctx

  function byCameraTags (component) {
    if (!camera || !camera.entity) return true
    if (!camera.entity.tags.length) return true
    if (!component.entity.tags.length) return true
    return component.entity.tags[0] === camera.entity.tags[0]
  }

  geometries = geometries || this.getComponents('Geometry').filter(byCameraTags)
  const ambientLights = this.getComponents('AmbientLight').filter(byCameraTags)
  const directionalLights = this.getComponents('DirectionalLight').filter(byCameraTags)
  const pointLights = this.getComponents('PointLight').filter(byCameraTags)
  const spotLights = this.getComponents('SpotLight').filter(byCameraTags)
  const areaLights = this.getComponents('AreaLight').filter(byCameraTags)
  const reflectionProbes = this.getComponents('ReflectionProbe').filter(byCameraTags)

  if (!shadowMapping && !shadowMappingLight) {
    directionalLights.forEach((light) => {
      if (light.castShadows) {
        const shadowCasters = geometries.filter((geometry) => {
          const material = geometry.entity.getComponent('Material')
          return material && material.castShadows
        })
        this.updateDirectionalLightShadowMap(light, shadowCasters)
      }
    })
  }

  if (!shadowMapping && !shadowMappingLight) {
    pointLights.forEach((light) => {
      if (light.castShadows) {
        const shadowCasters = geometries.filter((geometry) => {
          const material = geometry.entity.getComponent('Material')
          return material && material.castShadows
        })
        this.updatePointLightShadowMap(light, shadowCasters)
      }
    })
  }

  var sharedUniforms = this._sharedUniforms = this._sharedUniforms || {}
  sharedUniforms.uOutputEncoding = State.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear // TODO: State.postprocess
  if (forward) {
    sharedUniforms.uOutputEncoding = ctx.Encoding.Gamma
  }
  if (ctx.debugMode) {
    console.log('forward', forward, sharedUniforms.uOutputEncoding, ctx.Encoding.Gamma)
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
    sharedUniforms.uCameraPosition = camera.entity.transform.worldPosition
    sharedUniforms.uProjectionMatrix = camera.projectionMatrix
    sharedUniforms.uViewMatrix = camera.viewMatrix
    sharedUniforms.uInverseViewMatrix = camera.inverseViewMatrix
  }

  if (camera) {
    if (camera.postprocess && camera.ssao) {
      sharedUniforms.uAO = camera._frameAOTex
      sharedUniforms.uScreenSize = [ camera.viewport[2], camera.viewport[3] ] // TODO: should this be camera viewport size?
    }
    if (!camera.postprocess) {
      sharedUniforms.uExposure = camera.exposure
    }
  }

  ambientLights.forEach(function (light, i) {
    sharedUniforms['uAmbientLights[' + i + '].color'] = light.color
  })

  directionalLights.forEach(function (light, i) {
    var dir4 = [0, 0, 1, 0] // TODO: GC
    var dir = [0, 0, 0]
    vec4.multMat4(dir4, light.entity.transform.modelMatrix)
    vec3.set(dir, dir4)
    sharedUniforms['uDirectionalLights[' + i + '].direction'] = dir
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
    sharedUniforms['uPointLights[' + i + '].position'] = light.entity.transform.worldPosition
    sharedUniforms['uPointLights[' + i + '].color'] = light.color
    sharedUniforms['uPointLights[' + i + '].range'] = light.range
    sharedUniforms['uPointLightShadowMaps[' + i + ']'] = light._shadowCubemap
  })

  spotLights.forEach(function (light, i) {
    var transform = light.entity.transform
    var position = transform.worldPosition
    var target = light.target
    var dir = vec3.normalize(vec3.sub(vec3.copy(target), position))
    sharedUniforms['uSpotLights[' + i + '].position'] = light.entity.transform.position
    sharedUniforms['uSpotLights[' + i + '].direction'] = dir
    sharedUniforms['uSpotLights[' + i + '].color'] = light.color
    sharedUniforms['uSpotLights[' + i + '].angle'] = light.angle
    sharedUniforms['uSpotLights[' + i + '].range'] = light.range
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

  geometries.sort((a, b) => {
    var matA = a.entity.getComponent('Material')
    var matB = b.entity.getComponent('Material')
    var transparentA = matA.blend ? 1 : 0
    var transparentB = matB.blend ? 1 : 0
    return transparentA - transparentB
  })

  var firstTransparent = geometries.findIndex((g) => g.entity.getComponent('Material').blend)

  for (let i = 0; i < geometries.length; i++) {
    // also drawn below if transparent objects don't exist
    if ((firstTransparent === i) && skybox) {
      skybox.draw(camera, {
        outputEncoding: sharedUniforms.uOutputEncoding,
        backgroundMode: true
      })
    }
    const geometry = geometries[i]
    const transform = geometry.entity.transform
    if (!transform.enabled) {
      continue
    }

    // don't draw uninitialized geometries
    if (!geometry._attributes.aPosition) {
      continue
    }
    const material = geometry.entity.getComponent('Material')
    if (material.blend && shadowMapping) {
      continue
    }

    const skin = geometry.entity.getComponent('Skin')
    const cachedUniforms = material._uniforms

    if (material.baseColorMap) cachedUniforms.uBaseColorMap = material.baseColorMap
    cachedUniforms.uBaseColor = material.baseColor

    if (material.emissiveColorMap) cachedUniforms.uEmissiveColorMap = material.emissiveColorMap
    cachedUniforms.uEmissiveColor = material.emissiveColor
    cachedUniforms.uEmissiveIntensity = material.emissiveIntensity

    if (material.metallicMap) cachedUniforms.uMetallicMap = material.metallicMap
    if (!isNil(material.metallic)) cachedUniforms.uMetallic = material.metallic

    if (material.roughnessMap) cachedUniforms.uRoughnessMap = material.roughnessMap
    if (!isNil(material.roughness)) cachedUniforms.uRoughness = material.roughness

    if (material.metallicRoughnessMap) cachedUniforms.uMetallicRoughnessMap = material.metallicRoughnessMap

    if (material.diffuse) cachedUniforms.uDiffuse = material.diffuse
    if (material.specular) cachedUniforms.uSpecular = material.specular
    if (material.glossiness !== undefined) cachedUniforms.uGlossiness = material.glossiness
    if (material.diffuseMap) cachedUniforms.uDiffuseMap = material.diffuseMap
    if (material.specularGlossinessMap) cachedUniforms.uSpecularGlossinessMap = material.specularGlossinessMap

    if (material.normalMap) {
      cachedUniforms.uNormalMap = material.normalMap
      cachedUniforms.uNormalScale = material.normalScale
    }
    if (material.occlusionMap) cachedUniforms.uOcclusionMap = material.occlusionMap
    if (material.displacementMap) {
      cachedUniforms.uDisplacementMap = material.displacementMap
      cachedUniforms.uDisplacement = material.displacement
    }

    if (material.alphaMap) cachedUniforms.uAlphaMap = material.alphaMap

    if (material.uniforms) {
      for (var uniformName in material.uniforms) {
        sharedUniforms[uniformName] = material.uniforms[uniformName]
      }
    }

    if (skin) {
      cachedUniforms.uJointMat = skin.jointMatrices
    }

    let pipeline = null
    if (shadowMapping && !shadowMappingLight) {
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        depthPrePassOnly: true
      })
    } else if (shadowMapping) {
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        depthPassOnly: true
      })
    } else {
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        numAmbientLights: ambientLights.length,
        numDirectionalLights: directionalLights.length,
        numPointLights: pointLights.length,
        numSpotLights: spotLights.length,
        numAreaLights: areaLights.length,
        useReflectionProbes: reflectionProbes.length, // TODO: reflection probes true
        useSSAO: camera.postprocess && camera.ssao,
        useTonemapping: !camera.postprocess
      })
    }

    if (material.alphaTest !== undefined) {
      sharedUniforms.uAlphaTest = material.alphaTest
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
    var viewMatrix
    if (shadowMappingLight) {
      viewMatrix = shadowMappingLight._viewMatrix
    } else {
      viewMatrix = camera.viewMatrix
    }
    var normalMat = mat4.copy(viewMatrix)
    mat4.mult(normalMat, transform.modelMatrix)
    mat4.invert(normalMat)
    mat4.transpose(normalMat)
    cachedUniforms.uNormalMatrix = mat3.fromMat4(mat3.create(), normalMat)

    if (ctx.debugMode) {
      console.log('drawMeshes', 'pipeline', pipeline, cachedUniforms)
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
  // also drawn above if transparent objects exist
  if ((firstTransparent === -1) && skybox) {
    skybox.draw(camera, {
      outputEncoding: sharedUniforms.uOutputEncoding,
      backgroundMode: true
    })
  }
}

Renderer.prototype.draw = function () {
  const ctx = this._ctx

  if (State.paused) return

  this.update()

  if (State.profiler) State.profiler.startFrame()

  var cameras = this.getComponents('Camera')
  var overlays = this.getComponents('Overlay')
  var skyboxes = this.getComponents('Skybox')
  var reflectionProbes = this.getComponents('ReflectionProbe')

  // TODO: update light probes
  /*
  if (!vec3.equals(State.prevSunPosition, State.sunPosition)) {
    vec3.set(State.prevSunPosition, State.sunPosition)

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
    const screenSize = [camera.viewport[2], camera.viewport[3]]
    const halfScreenSize = [Math.floor(camera.viewport[2] / 2), Math.floor(camera.viewport[3] / 2)]
    const halfViewport = [0, 0, Math.floor(camera.viewport[2] / 2), Math.floor(camera.viewport[3] / 2)]
    if (State.profiler) State.profiler.time('depthPrepass', true)
    if (camera.postprocess) {
      ctx.submit(camera._drawFrameNormalsFboCommand, () => {
        const far = camera.far
        // TODO: Far clipping plane scaling fixes depth buffer precision artifacts
        // but breaks shadows on large scale scenes (eg maps)
        camera.set({ far: far * 0.99 })
        this.drawMeshes(camera, true)
        camera.set({ far: far })
      })
    }
    if (State.profiler) State.profiler.timeEnd('depthPrepass')
    if (camera.postprocess && camera.ssao) {
      if (State.profiler) State.profiler.time('ssao', true)
      ctx.submit(camera._ssaoCmd, {
        uniforms: {
          uNear: camera.near,
          uFar: camera.far,
          uFov: camera.fov,
          viewMatrix: camera.viewMatrix,
          uInverseViewMatrix: mat4.invert(mat4.copy(camera.viewMatrix)),
          viewProjectionInverseMatrix: mat4.invert(mat4.mult(mat4.copy(camera.viewMatrix), camera.projectionMatrix)), // TODO: GC
          cameraPositionWorldSpace: camera.entity.transform.worldPosition,
          uIntensity: camera.ssaoIntensity,
          uNoiseScale: [10, 10],
          uSampleRadiusWS: camera.ssaoRadius,
          uBias: camera.ssaoBias,
          uScreenSize: screenSize
        }
      })
      if (State.profiler) State.profiler.timeEnd('ssao')
      if (State.profiler) State.profiler.time('ssao-blur', true)
      ctx.submit(camera._bilateralBlurHCmd, {
        uniforms: {
          near: camera.near,
          far: camera.far,
          sharpness: camera.ssaoBlurSharpness,
          imageSize: screenSize,
          depthMapSize: screenSize,
          direction: [camera.ssaoBlurRadius, 0]
        }
      })
      ctx.submit(camera._bilateralBlurVCmd, {
        uniforms: {
          near: camera.near,
          far: camera.far,
          sharpness: camera.ssaoBlurSharpness,
          imageSize: screenSize,
          depthMapSize: screenSize,
          direction: [0, camera.ssaoBlurRadius]
        }
      })
    }
    if (State.profiler) State.profiler.timeEnd('ssao-blur')
    if (State.profiler) State.profiler.time('drawFrame', true)
    if (camera.postprocess) {
      ctx.submit(camera._drawFrameFboCommand, () => {
        this.drawMeshes(camera, false, null, null, skyboxes[0], false)
      })
    } else {
      ctx.submit({ viewport: camera.viewport }, () => {
        this.drawMeshes(camera, false, null, null, skyboxes[0], true)
      })
    }
    if (State.profiler) State.profiler.timeEnd('drawFrame')
    if (State.profiler) State.profiler.time('postprocess')
    if (camera.bloom) {
      ctx.submit(camera._thresholdCmd, {
        uniforms: {
          uExposure: camera.exposure,
          uBloomThreshold: camera.bloomThreshold,
          imageSize: halfScreenSize
        },
        viewport: halfViewport
      })

      for (let i = 0; i < 5; i++) {
        ctx.submit(camera._bloomHCmd, {
          uniforms: {
            direction: [camera.bloomRadius, 0],
            imageSize: halfScreenSize
          },
          viewport: halfViewport
        })
        ctx.submit(camera._bloomVCmd, {
          uniforms: {
            direction: [0, camera.bloomRadius],
            imageSize: halfScreenSize
          },
          viewport: halfViewport
        })
      }
    }
    if (camera.dof) {
      if (State.profiler) State.profiler.time('dof', true)
      for (let i = 0; i < camera.dofIterations; i++) {
        ctx.submit(camera._dofBlurHCmd, {
          uniforms: {
            near: camera.near,
            far: camera.far,
            sharpness: 0,
            imageSize: screenSize,
            depthMapSize: screenSize,
            direction: [camera.dofRadius, 0],
            uDOFDepth: camera.dofDepth,
            uDOFRange: camera.dofRange
          }
        })
        ctx.submit(camera._dofBlurVCmd, {
          uniforms: {
            near: camera.near,
            far: camera.far,
            sharpness: 0,
            imageSize: screenSize,
            depthMapSize: screenSize,
            direction: [0, camera.dofRadius],
            uDOFDepth: camera.dofDepth,
            uDOFRange: camera.dofRange
          }
        })
      }
      if (State.profiler) State.profiler.timeEnd('dof')
    }
    if (camera.postprocess) {
      ctx.submit(camera._blitCmd, {
        uniforms: {
          uExposure: camera.exposure,
          uFXAA: camera.fxaa,
          uFog: camera.fog,
          uBloom: camera.bloom,
          uBloomIntensity: camera.bloomIntensity,
          uNear: camera.near,
          uFar: camera.far,
          uFov: camera.fov,
          uSunDispertion: camera.sunDispertion,
          uSunIntensity: camera.sunIntensity,
          uInscatteringCoeffs: camera.inscatteringCoeffs,
          uFogColor: camera.fogColor,
          uFogStart: camera.fogStart,
          uFogDensity: camera.fogDensity,
          uSunPosition: camera.sunPosition,
          uOutputEncoding: ctx.Encoding.Gamma,
          uScreenSize: screenSize
        },
        viewport: camera.viewport
      })
    }
    if (State.profiler) State.profiler.time('postprocess')
  })

  overlays.forEach((overlay) => {
    const bounds = [overlay.x, overlay.y, overlay.width, overlay.height]
    if (overlay.x > 1 || overlay.y > 1 || overlay.width > 1 || overlay.height > 1) {
      bounds[0] /= ctx.gl.drawingBufferWidth
      bounds[1] /= ctx.gl.drawingBufferHeight
      bounds[2] /= ctx.gl.drawingBufferWidth
      bounds[3] /= ctx.gl.drawingBufferHeight
    }
    // overlay coordinates are from top left corner so we need to flip y
    bounds[1] = 1.0 - bounds[1] - bounds[3]
    ctx.submit(this.getOverlayCommand(), {
      uniforms: {
        uBounds: bounds,
        uTexture: overlay.texture
      }
    })
  })

  if (State.profiler) State.profiler.endFrame()
}

Renderer.prototype.entity = function (components, tags) {
  return createEntity(components, tags, this)
}

Renderer.prototype.add = function (entity, parent) {
  if (entity === this.root) {
    return entity
  }
  entity.transform.set({
    parent: parent ? parent.transform : entity.transform.parent || this.root.transform
  })
  return entity
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

Renderer.prototype.animation = function (opts) {
  return createAnimation(Object.assign({ ctx: this._ctx }, opts))
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

Renderer.prototype.orbiter = function (opts) {
  return createOrbiter(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.ambientLight = function (opts) {
  return createAmbientLight(Object.assign({ ctx: this._ctx }, opts))
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

Renderer.prototype.overlay = function (opts) {
  return createOverlay(Object.assign({ ctx: this._ctx }, opts))
}

module.exports = function createRenderer (opts) {
  return new Renderer(opts)
}
