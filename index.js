const path = require('path')
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
const createPostProcessing = require('./post-processing')
const createOrbiter = require('./orbiter')
const createAmbientLight = require('./ambient-light')
const createDirectionalLight = require('./directional-light')
const createPointLight = require('./point-light')
const createSpotLight = require('./spot-light')
const createAreaLight = require('./area-light')
const createReflectionProbe = require('./reflection-probe')
const createSkybox = require('./skybox')
const createOverlay = require('./overlay')
const loadGltf = require('./loaders/glTF')

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

const LOADERS = new Map().set(['.gltf', '.glb'], loadGltf)
const LOADERS_ENTRIES = Array.from(LOADERS.entries())

var State = {
  frame: 0,
  shadowQuality: 2,
  debug: false,
  profile: false,
  profiler: null,
  paused: false,
  rgbm: false
}

function isNil(x) {
  return x == null
}

// TODO remove, should be in AABB
function aabbToPoints(bbox) {
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
function Renderer(opts) {
  this.entities = []
  this.root = this.entity()

  // check if we passed gl context or options object
  opts = opts.texture2D ? { ctx: opts } : opts

  const ctx = (this._ctx = opts.ctx)

  const gl = opts.ctx.gl
  gl.getExtension('OES_standard_derivatives')

  this._dummyTexture2D = ctx.texture2D({ width: 4, height: 4 })
  this._dummyTextureCube = ctx.textureCube({ width: 4, height: 4 })

  this._debug = false
  this._programCacheMap = {
    values: [],
    getValue: function(flags, vert, frag) {
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
    setValue: function(flags, vert, frag, program) {
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

Renderer.prototype.updateDirectionalLightShadowMap = function(
  light,
  geometries
) {
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
  const bboxPointsInLightSpace = shadowBboxPoints.map((p) =>
    vec3.multMat4(vec3.copy(p), light._viewMatrix)
  )
  const sceneBboxInLightSpace = aabb.fromPoints(bboxPointsInLightSpace)

  const lightNear = -sceneBboxInLightSpace[1][2]
  const lightFar = -sceneBboxInLightSpace[0][2]

  light.set({
    _near: lightNear,
    _far: lightFar
  })

  mat4.ortho(
    light._projectionMatrix,
    sceneBboxInLightSpace[0][0],
    sceneBboxInLightSpace[1][0],
    sceneBboxInLightSpace[0][1],
    sceneBboxInLightSpace[1][1],
    lightNear,
    lightFar
  )

  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(null, true, light, geometries)
  })
}

Renderer.prototype.updateSpotLightShadowMap = function(light, geometries) {
  const position = light.entity.transform.worldPosition
  const target = [0, 0, 1, 0]
  const up = [0, 1, 0, 0]
  vec4.multMat4(target, light.entity.transform.modelMatrix)
  // vec3.add(target, position)
  vec4.multMat4(up, light.entity.transform.modelMatrix)
  mat4.lookAt(light._viewMatrix, position, target, up)

  const shadowBboxPoints = geometries.reduce((points, geometry) => {
    return points.concat(aabbToPoints(geometry.entity.transform.worldBounds))
  }, [])

  // TODO: gc vec3.copy, all the bounding box creation
  const bboxPointsInLightSpace = shadowBboxPoints.map((p) =>
    vec3.multMat4(vec3.copy(p), light._viewMatrix)
  )
  const sceneBboxInLightSpace = aabb.fromPoints(bboxPointsInLightSpace)

  const lightNear = -sceneBboxInLightSpace[1][2]
  const lightFar = -sceneBboxInLightSpace[0][2]

  light.set({
    _near: lightNear,
    _far: lightFar
  })

  mat4.perspective(
    light._projectionMatrix,
    2 * light.angle,
    light._shadowMap.width / light._shadowMap.height,
    lightNear,
    lightFar
  )

  const ctx = this._ctx
  ctx.submit(light._shadowMapDrawCommand, () => {
    this.drawMeshes(null, true, light, geometries)
  })
}

Renderer.prototype.updatePointLightShadowMap = function(light, geometries) {
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

Renderer.prototype.parseShader = function(string, options) {
  // Unroll loop
  const unrollLoopPattern = /#pragma unroll_loop[\s]+?for \(int i = (\d+); i < (\d+|\D+); i\+\+\) \{([\s\S]+?)(?=\})\}/g

  string = string.replace(unrollLoopPattern, function(
    match,
    start,
    end,
    snippet
  ) {
    let unroll = ''

    // Replace lights number
    end = end
      .replace(/NUM_AMBIENT_LIGHTS/g, options.numAmbientLights || 0)
      .replace(/NUM_DIRECTIONAL_LIGHTS/g, options.numDirectionalLights || 0)
      .replace(/NUM_POINT_LIGHTS/g, options.numPointLights || 0)
      .replace(/NUM_SPOT_LIGHTS/g, options.numSpotLights || 0)
      .replace(/NUM_AREA_LIGHTS/g, options.numAreaLights || 0)

    for (let i = Number.parseInt(start); i < Number.parseInt(end); i++) {
      unroll += snippet.replace(/\[i\]/g, `[${i}]`)
    }

    return unroll
  })

  return string
}

Renderer.prototype.getMaterialProgramAndFlags = function(
  geometry,
  material,
  skin,
  options
) {
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
    flags.push('#define USE_TEXCOORD_0')
  }
  if (geometry._attributes.aTexCoord1) {
    flags.push('#define USE_TEXCOORD_1')
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
    flags.push(
      `#define BASE_COLOR_MAP_TEX_COORD_INDEX ${material.baseColorMap
        .texCoord || 0}`
    )
    if (material.baseColorMap.texCoordTransformMatrix) {
      flags.push('#define USE_BASE_COLOR_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (material.alphaMap) {
    flags.push('#define USE_ALPHA_MAP')
    flags.push(
      `#define ALPHA_MAP_TEX_COORD_INDEX ${material.alphaMap.texCoord || 0}`
    )
    if (material.alphaMap.texCoordTransformMatrix) {
      flags.push('#define USE_ALPHA_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (material.alphaTest) {
    flags.push('#define USE_ALPHA_TEST')
  }

  if (options.depthPrePassOnly) {
    flags.push('#define DEPTH_PRE_PASS_ONLY')
    flags.push('#define SHADOW_QUALITY ' + 0)
    flags.push('#define NUM_AMBIENT_LIGHTS ' + 0)
    flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + 0)
    flags.push('#define NUM_POINT_LIGHTS ' + 0)
    flags.push('#define NUM_SPOT_LIGHTS ' + 0)
    flags.push('#define NUM_AREA_LIGHTS ' + 0)
    return {
      flags: flags,
      vert: material.vert || DEPTH_PASS_VERT,
      frag: material.frag || DEPTH_PRE_PASS_FRAG
    }
  }

  if (options.depthPassOnly) {
    flags.push('#define DEPTH_PASS_ONLY')
    flags.push('#define SHADOW_QUALITY ' + 0)
    flags.push('#define NUM_AMBIENT_LIGHTS ' + 0)
    flags.push('#define NUM_DIRECTIONAL_LIGHTS ' + 0)
    flags.push('#define NUM_POINT_LIGHTS ' + 0)
    flags.push('#define NUM_SPOT_LIGHTS ' + 0)
    flags.push('#define NUM_AREA_LIGHTS ' + 0)
    return {
      flags: flags,
      vert: material.vert || DEPTH_PASS_VERT,
      frag: material.frag || DEPTH_PASS_FRAG
    }
  }

  flags.push(
    '#define SHADOW_QUALITY ' +
      (material.receiveShadows ? State.shadowQuality : 0)
  )

  if (material.unlit) {
    if (flags.indexOf('#define USE_UNLIT_WORKFLOW') === -1) {
      flags.push('#define USE_UNLIT_WORKFLOW')
    }
  } else if (material.useSpecularGlossinessWorkflow) {
    flags.push('#define USE_SPECULAR_GLOSSINESS_WORKFLOW')

    if (material.diffuseMap) {
      flags.push('#define USE_DIFFUSE_MAP')
      flags.push(
        `#define DIFFUSE_MAP_TEX_COORD_INDEX ${material.diffuseMap.texCoord ||
          0}`
      )
      if (material.diffuseMap.texCoordTransformMatrix) {
        flags.push('#define USE_DIFFUSE_MAP_TEX_COORD_TRANSFORM')
      }
    }
    if (material.specularGlossinessMap) {
      flags.push('#define USE_SPECULAR_GLOSSINESS_MAP')
      flags.push(
        `#define SPECULAR_GLOSSINESS_MAP_TEX_COORD_INDEX ${material
          .specularGlossinessMap.texCoord || 0}`
      )
      if (material.specularGlossinessMap.texCoordTransformMatrix) {
        flags.push('#define USE_SPECULAR_GLOSSINESS_MAP_TEX_COORD_TRANSFORM')
      }
    }
  } else {
    flags.push('#define USE_METALLIC_ROUGHNESS_WORKFLOW')

    if (material.metallicMap) {
      flags.push('#define USE_METALLIC_MAP')
      flags.push(
        `#define METALLIC_MAP_TEX_COORD_INDEX ${material.metallicMap.texCoord ||
          0}`
      )
      if (material.metallicMap.texCoordTransformMatrix) {
        flags.push('#define USE_METALLIC_MAP_TEX_COORD_TRANSFORM')
      }
    }
    if (material.roughnessMap) {
      flags.push('#define USE_ROUGHNESS_MAP')
      flags.push(
        `#define ROUGHNESS_MAP_TEX_COORD_INDEX ${material.roughnessMap
          .texCoord || 0}`
      )
      if (material.roughnessMap.texCoordTransformMatrix) {
        flags.push('#define USE_ROUGHNESS_MAP_TEX_COORD_TRANSFORM')
      }
    }
    if (material.metallicRoughnessMap) {
      flags.push('#define USE_METALLIC_ROUGHNESS_MAP')
      flags.push(
        `#define METALLIC_ROUGHNESS_MAP_TEX_COORD_INDEX ${material
          .metallicRoughnessMap.texCoord || 0}`
      )
      if (material.metallicRoughnessMap.texCoordTransformMatrix) {
        flags.push('#define USE_METALLIC_ROUGHNESS_MAP_TEX_COORD_TRANSFORM')
      }
    }
  }

  if (material.occlusionMap) {
    flags.push('#define USE_OCCLUSION_MAP')
    flags.push(
      `#define OCCLUSION_MAP_TEX_COORD_INDEX ${material.occlusionMap.texCoord ||
        0}`
    )
    if (material.occlusionMap.texCoordTransformMatrix) {
      flags.push('#define USE_OCCLUSION_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (material.normalMap) {
    flags.push('#define USE_NORMAL_MAP')
    flags.push(
      `#define NORMAL_MAP_TEX_COORD_INDEX ${material.normalMap.texCoord || 0}`
    )
    if (material.normalMap.texCoordTransformMatrix) {
      flags.push('#define USE_NORMAL_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (material.emissiveColorMap) {
    flags.push('#define USE_EMISSIVE_COLOR_MAP')
    flags.push(
      `#define EMISSIVE_COLOR_MAP_TEX_COORD_INDEX ${material.emissiveColorMap
        .texCoord || 0}`
    )
    if (material.emissiveColorMap.texCoordTransformMatrix) {
      flags.push('#define USE_EMISSIVE_COLOR_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (!isNil(material.emissiveColor)) {
    flags.push('#define USE_EMISSIVE_COLOR')
  }
  if (!isNil(material.clearCoat)) {
    flags.push('#define USE_CLEAR_COAT')
  }
  if (material.clearCoatNormalMap) {
    flags.push('#define USE_CLEAR_COAT_NORMAL_MAP')
    flags.push(
      `#define CLEAR_COAT_NORMAL_MAP_TEX_COORD_INDEX ${material
        .clearCoatNormalMap.texCoord || 0}`
    )
    if (material.clearCoatNormalMap.texCoordTransformMatrix) {
      flags.push('#define USE_CLEAR_COAT_NORMAL_MAP_TEX_COORD_TRANSFORM')
    }
  }
  if (material.blend) {
    flags.push('#define USE_BLEND')
  }

  flags.push('#define NUM_AMBIENT_LIGHTS ' + (options.numAmbientLights || 0))
  flags.push(
    '#define NUM_DIRECTIONAL_LIGHTS ' + (options.numDirectionalLights || 0)
  )
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
    vert: material.vert || PBR_VERT,
    frag: material.frag || PBR_FRAG
  }
}

Renderer.prototype.buildProgram = function(vertSrc, fragSrc) {
  var ctx = this._ctx
  let program = null
  try {
    program = ctx.program({ vert: vertSrc, frag: fragSrc })
  } catch (e) {
    console.error('pex-renderer glsl error', e)
    program = ctx.program({ vert: ERROR_VERT, frag: ERROR_FRAG })
    throw e
  }
  return program
}

Renderer.prototype.getMaterialProgram = function(
  geometry,
  material,
  skin,
  options
) {
  var { flags, vert, frag } = this.getMaterialProgramAndFlags(
    geometry,
    material,
    skin,
    options
  )
  var flagsStr = flags.join('\n') + '\n'
  var vertSrc = flagsStr + vert
  var fragSrc = flagsStr + frag
  var program = this._programCacheMap.getValue(flags, vert, frag)
  if (!program) {
    program = this.buildProgram(
      this.parseShader(vertSrc, options),
      this.parseShader(fragSrc, options)
    )
    this._programCacheMap.setValue(flags, vert, frag, program)
  }
  return program
}

Renderer.prototype.traverseTransformTree = function(
  transform,
  beforeCallback,
  afterCallback
) {
  if (!transform.enabled) return
  beforeCallback(transform)
  transform.children.forEach((child) => {
    this.traverseTransformTree(child, beforeCallback, afterCallback)
  })
  if (afterCallback) afterCallback(transform)
}

Renderer.prototype.update = function() {
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

Renderer.prototype.getGeometryPipeline = function(
  geometry,
  material,
  skin,
  opts
) {
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
      cullFaceMode: material.cullFaceMode,
      primitive: geometry.primitive
    })
    this._pipelineCache[hash] = pipeline
  }

  return pipeline
}

Renderer.prototype.getOverlayCommand = function() {
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

Renderer.prototype.getComponents = function(type) {
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
Renderer.prototype.drawMeshes = function(
  camera,
  shadowMapping,
  shadowMappingLight,
  geometries,
  skybox,
  forward
) {
  const ctx = this._ctx

  function byEnabledAndCameraTags(component) {
    if (!component.enabled) return false
    if (!camera || !camera.entity) return true
    if (!camera.entity.tags.length) return true
    if (!component.entity.tags.length) return true
    return component.entity.tags[0] === camera.entity.tags[0]
  }

  geometries =
    geometries || this.getComponents('Geometry').filter(byEnabledAndCameraTags)
  const ambientLights = this.getComponents('AmbientLight').filter(
    byEnabledAndCameraTags
  )
  const directionalLights = this.getComponents('DirectionalLight').filter(
    byEnabledAndCameraTags
  )
  const pointLights = this.getComponents('PointLight').filter(
    byEnabledAndCameraTags
  )
  const spotLights = this.getComponents('SpotLight').filter(
    byEnabledAndCameraTags
  )
  const areaLights = this.getComponents('AreaLight').filter(
    byEnabledAndCameraTags
  )
  const reflectionProbes = this.getComponents('ReflectionProbe').filter(
    byEnabledAndCameraTags
  )

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

    pointLights.forEach((light) => {
      if (light.castShadows) {
        const shadowCasters = geometries.filter((geometry) => {
          const material = geometry.entity.getComponent('Material')
          return material && material.castShadows
        })
        this.updatePointLightShadowMap(light, shadowCasters)
      }
    })

    spotLights.forEach((light) => {
      if (light.castShadows) {
        const shadowCasters = geometries.filter((geometry) => {
          const material = geometry.entity.getComponent('Material')
          return material && material.castShadows
        })
        this.updateSpotLightShadowMap(light, shadowCasters)
      }
    })
  }

  var sharedUniforms = (this._sharedUniforms = this._sharedUniforms || {})
  sharedUniforms.uOutputEncoding = State.rgbm
    ? ctx.Encoding.RGBM
    : ctx.Encoding.Linear // TODO: State.postprocess
  if (forward) {
    sharedUniforms.uOutputEncoding = ctx.Encoding.Gamma
  }

  // TODO:  find nearest reflection probe
  if (reflectionProbes.length > 0) {
    sharedUniforms.uReflectionMap = reflectionProbes[0]._reflectionMap
    sharedUniforms.uReflectionMapEncoding =
      reflectionProbes[0]._reflectionMap.encoding
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
    const postProcessingCmp = camera.entity.getComponent('PostProcessing')
    if (postProcessingCmp && postProcessingCmp.ssao) {
      sharedUniforms.uAO = postProcessingCmp._frameAOTex
      sharedUniforms.uScreenSize = [camera.viewport[2], camera.viewport[3]] // TODO: should this be camera viewport size?
    }
    if (!(postProcessingCmp && postProcessingCmp.enabled)) {
      sharedUniforms.uExposure = camera.exposure
    }
  }

  ambientLights.forEach((light, i) => {
    sharedUniforms['uAmbientLights[' + i + '].color'] = light.color
  })

  directionalLights.forEach((light, i) => {
    const dir4 = [0, 0, 1, 0] // TODO: GC
    const dir = [0, 0, 0]
    vec4.multMat4(dir4, light.entity.transform.modelMatrix)
    vec3.set(dir, dir4)

    sharedUniforms['uDirectionalLights[' + i + '].direction'] = dir
    sharedUniforms['uDirectionalLights[' + i + '].color'] = light.color
    sharedUniforms['uDirectionalLights[' + i + '].castShadows'] =
      light.castShadows
    sharedUniforms['uDirectionalLights[' + i + '].projectionMatrix'] =
      light._projectionMatrix
    sharedUniforms['uDirectionalLights[' + i + '].viewMatrix'] =
      light._viewMatrix
    sharedUniforms['uDirectionalLights[' + i + '].near'] = light._near
    sharedUniforms['uDirectionalLights[' + i + '].far'] = light._far
    sharedUniforms['uDirectionalLights[' + i + '].bias'] = light.bias
    sharedUniforms[
      'uDirectionalLights[' + i + '].shadowMapSize'
    ] = light.castShadows
      ? [light._shadowMap.width, light._shadowMap.height]
      : [0, 0]
    sharedUniforms['uDirectionalLightShadowMaps[' + i + ']'] = light.castShadows
      ? light._shadowMap
      : this._dummyTexture2D
  })

  pointLights.forEach((light, i) => {
    sharedUniforms['uPointLights[' + i + '].position'] =
      light.entity.transform.worldPosition
    sharedUniforms['uPointLights[' + i + '].color'] = light.color
    sharedUniforms['uPointLights[' + i + '].range'] = light.range
    sharedUniforms['uPointLights[' + i + '].castShadows'] = light.castShadows
    sharedUniforms['uPointLightShadowMaps[' + i + ']'] = light.castShadows
      ? light._shadowCubemap
      : this._dummyTextureCube
  })

  spotLights.forEach((light, i) => {
    const dir4 = [0, 0, 1, 0] // TODO: GC
    const dir = [0, 0, 0]
    vec4.multMat4(dir4, light.entity.transform.modelMatrix)
    vec3.set(dir, dir4)

    sharedUniforms['uSpotLights[' + i + '].position'] =
      light.entity.transform.position
    sharedUniforms['uSpotLights[' + i + '].direction'] = dir
    sharedUniforms['uSpotLights[' + i + '].color'] = light.color
    sharedUniforms['uSpotLights[' + i + '].angle'] = light.angle
    sharedUniforms['uSpotLights[' + i + '].innerAngle'] = light.innerAngle
    sharedUniforms['uSpotLights[' + i + '].range'] = light.range
    sharedUniforms['uSpotLights[' + i + '].castShadows'] = light.castShadows
    sharedUniforms['uSpotLights[' + i + '].projectionMatrix'] =
      light._projectionMatrix
    sharedUniforms['uSpotLights[' + i + '].viewMatrix'] = light._viewMatrix
    sharedUniforms['uSpotLights[' + i + '].near'] = light._near
    sharedUniforms['uSpotLights[' + i + '].far'] = light._far
    sharedUniforms['uSpotLights[' + i + '].bias'] = light.bias
    sharedUniforms['uSpotLights[' + i + '].shadowMapSize'] = light.castShadows
      ? [light._shadowMap.width, light._shadowMap.height]
      : [0, 0]
    sharedUniforms['uSpotLightShadowMaps[' + i + ']'] = light.castShadows
      ? light._shadowMap
      : this._dummyTexture2D
  })

  areaLights.forEach((light, i) => {
    sharedUniforms.ltc_mat = light.ltc_mat_texture
    sharedUniforms.ltc_mag = light.ltc_mag_texture
    sharedUniforms['uAreaLights[' + i + '].position'] =
      light.entity.transform.position
    sharedUniforms['uAreaLights[' + i + '].color'] = light.color
    sharedUniforms['uAreaLights[' + i + '].intensity'] = light.intensity // FIXME: why area light has intensity and other lights don't?
    sharedUniforms['uAreaLights[' + i + '].rotation'] =
      light.entity.transform.rotation
    sharedUniforms['uAreaLights[' + i + '].size'] = [
      light.entity.transform.scale[0] / 2,
      light.entity.transform.scale[1] / 2
    ]
  })

  geometries.sort((a, b) => {
    var matA = a.entity.getComponent('Material')
    var matB = b.entity.getComponent('Material')
    var transparentA = matA.blend ? 1 : 0
    var transparentB = matB.blend ? 1 : 0
    return transparentA - transparentB
  })

  var firstTransparent = geometries.findIndex(
    (g) => g.entity.getComponent('Material').blend
  )

  for (let i = 0; i < geometries.length; i++) {
    // also drawn below if transparent objects don't exist
    if (firstTransparent === i && skybox && skybox.enabled) {
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
    if (!material.enabled || (material.blend && shadowMapping)) {
      continue
    }

    const skin = geometry.entity.getComponent('Skin')
    const cachedUniforms = material._uniforms

    if (material.baseColorMap) {
      cachedUniforms.uBaseColorMap =
        material.baseColorMap.texture || material.baseColorMap
      if (material.baseColorMap.texCoordTransformMatrix) {
        cachedUniforms.uBaseColorMapTexCoordTransform =
          material.baseColorMap.texCoordTransformMatrix
      }
    }
    cachedUniforms.uBaseColor = material.baseColor

    if (material.emissiveColorMap) {
      cachedUniforms.uEmissiveColorMap =
        material.emissiveColorMap.texture || material.emissiveColorMap
      if (material.emissiveColorMap.texCoordTransformMatrix) {
        cachedUniforms.uEmissiveColorMapTexCoordTransform =
          material.emissiveColorMap.texCoordTransformMatrix
      }
    }
    if (!isNil(material.emissiveColor)) {
      cachedUniforms.uEmissiveColor = material.emissiveColor
      cachedUniforms.uEmissiveIntensity = material.emissiveIntensity
    }

    if (material.useSpecularGlossinessWorkflow) {
      if (material.diffuse) cachedUniforms.uDiffuse = material.diffuse
      if (material.specular) cachedUniforms.uSpecular = material.specular
      if (!isNil(material.glossiness))
        cachedUniforms.uGlossiness = material.glossiness
      if (material.diffuseMap) {
        cachedUniforms.uDiffuseMap =
          material.diffuseMap.texture || material.diffuseMap
        if (material.diffuseMap.texCoordTransformMatrix) {
          cachedUniforms.uDiffuseMapTexCoordTransform =
            material.diffuseMap.texCoordTransformMatrix
        }
      }
      if (material.specularGlossinessMap) {
        cachedUniforms.uSpecularGlossinessMap =
          material.specularGlossinessMap.texture ||
          material.specularGlossinessMap
        if (material.specularGlossinessMap.texCoordTransformMatrix) {
          cachedUniforms.uSpecularGlossinessMapTexCoordTransform =
            material.specularGlossinessMap.texCoordTransformMatrix
        }
      }
    } else if (!material.unlit) {
      if (material.metallicMap) {
        cachedUniforms.uMetallicMap =
          material.metallicMap.texture || material.metallicMap
        if (material.metallicMap.texCoordTransformMatrix) {
          cachedUniforms.uMetallicMapTexCoordTransform =
            material.metallicMap.texCoordTransformMatrix
        }
      }
      if (!isNil(material.metallic))
        cachedUniforms.uMetallic = material.metallic

      if (material.roughnessMap) {
        cachedUniforms.uRoughnessMap =
          material.roughnessMap.texture || material.roughnessMap
        if (material.roughnessMap.texCoordTransformMatrix) {
          cachedUniforms.uRoughnessMapTexCoordTransform =
            material.roughnessMap.texCoordTransformMatrix
        }
      }
      if (!isNil(material.roughness))
        cachedUniforms.uRoughness = material.roughness

      if (material.metallicRoughnessMap) {
        cachedUniforms.uMetallicRoughnessMap =
          material.metallicRoughnessMap.texture || material.metallicRoughnessMap
        if (material.metallicRoughnessMap.texCoordTransformMatrix) {
          cachedUniforms.uMetallicRoughnessMapTexCoordTransform =
            material.metallicRoughnessMap.texCoordTransformMatrix
        }
      }
    }

    cachedUniforms.uReflectance = material.reflectance
    if (!isNil(material.clearCoat)) {
      cachedUniforms.uClearCoat = material.clearCoat
      cachedUniforms.uClearCoatRoughness = material.clearCoatRoughness || 0.04
    }
    if (material.clearCoatNormalMap) {
      cachedUniforms.uClearCoatNormalMap =
        material.clearCoatNormalMap.texture || material.clearCoatNormalMap
      if (material.clearCoatNormalMap.texCoordTransformMatrix) {
        cachedUniforms.uClearCoatNormalMapTexCoordTransform =
          material.clearCoatNormalMap.texCoordTransformMatrix
      }
      cachedUniforms.uClearCoatNormalMapScale = material.clearCoatNormalMapScale
    }

    if (material.normalMap) {
      cachedUniforms.uNormalMap =
        material.normalMap.texture || material.normalMap
      cachedUniforms.uNormalScale = material.normalScale
      if (material.normalMap.texCoordTransformMatrix) {
        cachedUniforms.uNormalMapTexCoordTransform =
          material.normalMap.texCoordTransformMatrix
      }
    }
    if (material.occlusionMap) {
      cachedUniforms.uOcclusionMap =
        material.occlusionMap.texture || material.occlusionMap
      if (material.occlusionMap.texCoordTransformMatrix) {
        cachedUniforms.uOcclusionMapTexCoordTransform =
          material.occlusionMap.texCoordTransformMatrix
      }
    }
    if (material.displacementMap) {
      cachedUniforms.uDisplacementMap = material.displacementMap
      cachedUniforms.uDisplacement = material.displacement
    }

    if (material.alphaMap) {
      cachedUniforms.uAlphaMap = material.alphaMap.texture || material.alphaMap
      if (material.alphaMap.texCoordTransformMatrix) {
        cachedUniforms.uAlphaMapTexCoordTransform =
          material.alphaMap.texCoordTransformMatrix
      }
    }

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
      const postProcessingCmp = camera.entity.getComponent('PostProcessing')
      pipeline = this.getGeometryPipeline(geometry, material, skin, {
        numAmbientLights: ambientLights.length,
        numDirectionalLights: directionalLights.length,
        numPointLights: pointLights.length,
        numSpotLights: spotLights.length,
        numAreaLights: areaLights.length,
        useReflectionProbes: reflectionProbes.length, // TODO: reflection probes true
        useSSAO:
          postProcessingCmp &&
          postProcessingCmp.enabled &&
          postProcessingCmp.ssao,
        useTonemapping: !(postProcessingCmp && postProcessingCmp.enabled)
      })
    }

    if (material.alphaTest !== undefined) {
      sharedUniforms.uAlphaTest = material.alphaTest
    }

    sharedUniforms.uPointSize = material.pointSize

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
  if (firstTransparent === -1 && skybox && skybox.enabled) {
    skybox.draw(camera, {
      outputEncoding: sharedUniforms.uOutputEncoding,
      backgroundMode: true
    })
  }
}

Renderer.prototype.draw = function() {
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
  cameras
    .filter((camera) => camera.enabled)
    .forEach((camera) => {
      const screenSize = [camera.viewport[2], camera.viewport[3]]
      const halfScreenSize = [
        Math.floor(camera.viewport[2] / 2),
        Math.floor(camera.viewport[3] / 2)
      ]
      const halfViewport = [
        0,
        0,
        Math.floor(camera.viewport[2] / 2),
        Math.floor(camera.viewport[3] / 2)
      ]
      const postProcessingCmp = camera.entity.getComponent('PostProcessing')
      if (postProcessingCmp && postProcessingCmp.enabled) {
        if (State.profiler) State.profiler.time('depthPrepass', true)
        ctx.submit(postProcessingCmp._drawFrameNormalsFboCommand, () => {
          const far = camera.far
          // TODO: Far clipping plane scaling fixes depth buffer precision artifacts
          // but breaks shadows on large scale scenes (eg maps)
          camera.set({ far: far * 0.99 })
          this.drawMeshes(camera, true)
          camera.set({ far: far })
        })
        if (State.profiler) State.profiler.timeEnd('depthPrepass')
      }
      if (
        postProcessingCmp &&
        postProcessingCmp.enabled &&
        postProcessingCmp.ssao
      ) {
        if (State.profiler) State.profiler.time('ssao', true)
        ctx.submit(postProcessingCmp._ssaoCmd, {
          uniforms: {
            uNear: camera.near,
            uFar: camera.far,
            uFov: camera.fov,
            viewMatrix: camera.viewMatrix,
            uInverseViewMatrix: mat4.invert(mat4.copy(camera.viewMatrix)),
            viewProjectionInverseMatrix: mat4.invert(
              mat4.mult(mat4.copy(camera.viewMatrix), camera.projectionMatrix)
            ), // TODO: GC
            cameraPositionWorldSpace: camera.entity.transform.worldPosition,
            uIntensity: postProcessingCmp.ssaoIntensity,
            uNoiseScale: [10, 10],
            uSampleRadiusWS: postProcessingCmp.ssaoRadius,
            uBias: postProcessingCmp.ssaoBias,
            uScreenSize: screenSize
          }
        })
        if (State.profiler) State.profiler.timeEnd('ssao')
        if (State.profiler) State.profiler.time('ssao-blur', true)
        ctx.submit(postProcessingCmp._bilateralBlurHCmd, {
          uniforms: {
            near: camera.near,
            far: camera.far,
            sharpness: postProcessingCmp.ssaoBlurSharpness,
            imageSize: screenSize,
            depthMapSize: screenSize,
            direction: [postProcessingCmp.ssaoBlurRadius, 0]
          }
        })
        ctx.submit(postProcessingCmp._bilateralBlurVCmd, {
          uniforms: {
            near: camera.near,
            far: camera.far,
            sharpness: postProcessingCmp.ssaoBlurSharpness,
            imageSize: screenSize,
            depthMapSize: screenSize,
            direction: [0, postProcessingCmp.ssaoBlurRadius]
          }
        })
        if (State.profiler) State.profiler.timeEnd('ssao-blur')
      }
      if (State.profiler) State.profiler.time('drawFrame', true)
      if (postProcessingCmp && postProcessingCmp.enabled) {
        ctx.submit(postProcessingCmp._drawFrameFboCommand, () => {
          this.drawMeshes(camera, false, null, null, skyboxes[0], false)
        })
      } else {
        ctx.submit({ viewport: camera.viewport }, () => {
          this.drawMeshes(camera, false, null, null, skyboxes[0], true)
        })
      }
      if (State.profiler) State.profiler.timeEnd('drawFrame')
      if (State.profiler) State.profiler.time('postprocess')
      if (
        postProcessingCmp &&
        postProcessingCmp.enabled &&
        postProcessingCmp.bloom
      ) {
        ctx.submit(postProcessingCmp._thresholdCmd, {
          uniforms: {
            uExposure: camera.exposure,
            uBloomThreshold: postProcessingCmp.bloomThreshold,
            imageSize: halfScreenSize
          },
          viewport: halfViewport
        })

        for (let i = 0; i < 5; i++) {
          ctx.submit(postProcessingCmp._bloomHCmd, {
            uniforms: {
              direction: [postProcessingCmp.bloomRadius, 0],
              imageSize: halfScreenSize
            },
            viewport: halfViewport
          })
          ctx.submit(postProcessingCmp._bloomVCmd, {
            uniforms: {
              direction: [0, postProcessingCmp.bloomRadius],
              imageSize: halfScreenSize
            },
            viewport: halfViewport
          })
        }
      }
      if (
        postProcessingCmp &&
        postProcessingCmp.enabled &&
        postProcessingCmp.dof
      ) {
        if (State.profiler) State.profiler.time('dof', true)
        ctx.submit(postProcessingCmp._dofCmd, {
          uniforms: {
            uFar: camera.far,
            uNear: camera.near,
            imageSize: screenSize,
            depthMapSize: screenSize,
            uPixelSize: [
              1 / ctx.gl.drawingBufferWidth,
              1 / ctx.gl.drawingBufferHeight
            ],
            uFocusDistance: postProcessingCmp.dofFocusDistance,
            uFocalLength: camera.focalLength,
            uAperture: postProcessingCmp.dofAperture,
            uDOFDebug: postProcessingCmp.dofDebug
          }
        })
        if (State.profiler) State.profiler.timeEnd('dof')
      }
      if (postProcessingCmp && postProcessingCmp.enabled) {
        ctx.submit(postProcessingCmp._blitCmd, {
          uniforms: {
            uNear: camera.near,
            uFar: camera.far,
            uFov: camera.fov,
            uExposure: camera.exposure,
            uFXAA: postProcessingCmp.fxaa,
            uFog: postProcessingCmp.fog,
            uBloom: postProcessingCmp.bloom,
            uBloomIntensity: postProcessingCmp.bloomIntensity,
            uSunDispertion: postProcessingCmp.sunDispertion,
            uSunIntensity: postProcessingCmp.sunIntensity,
            uSunColor: postProcessingCmp.sunColor,
            uInscatteringCoeffs: postProcessingCmp.inscatteringCoeffs,
            uFogColor: postProcessingCmp.fogColor,
            uFogStart: postProcessingCmp.fogStart,
            uFogDensity: postProcessingCmp.fogDensity,
            uSunPosition: postProcessingCmp.sunPosition,
            uOutputEncoding: ctx.Encoding.Gamma,
            uOverlay: postProcessingCmp.dof
              ? postProcessingCmp._frameDofBlurTex
              : postProcessingCmp._frameColorTex,
            uScreenSize: screenSize
          },
          viewport: camera.viewport
        })
        if (State.profiler) State.profiler.timeEnd('postprocess')
      }
    })

  overlays
    .filter((overlay) => overlay.enabled)
    .forEach((overlay) => {
      const bounds = [overlay.x, overlay.y, overlay.width, overlay.height]
      if (
        overlay.x > 1 ||
        overlay.y > 1 ||
        overlay.width > 1 ||
        overlay.height > 1
      ) {
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

Renderer.prototype.entity = function(components, tags) {
  return createEntity(components, tags, this)
}

Renderer.prototype.add = function(entity, parent) {
  if (entity === this.root) {
    return entity
  }

  entity.transform.set({
    parent: parent
      ? parent.transform
      : entity.transform.parent || this.root.transform
  })

  return entity
}

Renderer.prototype.remove = function(entity) {
  entity.transform.set({ parent: null })
}

Renderer.prototype.transform = function(opts) {
  return createTransform(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.skin = function(opts) {
  return createSkin(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.morph = function(opts) {
  return createMorph(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.animation = function(opts) {
  return createAnimation(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.geometry = function(opts) {
  return createGeometry(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.material = function(opts) {
  return createMaterial(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.camera = function(opts) {
  return createCamera(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
}

Renderer.prototype.postProcessing = function(opts) {
  return createPostProcessing(
    Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts)
  )
}

Renderer.prototype.orbiter = function(opts) {
  return createOrbiter(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.ambientLight = function(opts) {
  return createAmbientLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.directionalLight = function(opts) {
  return createDirectionalLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.pointLight = function(opts) {
  return createPointLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.spotLight = function(opts) {
  return createSpotLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.areaLight = function(opts) {
  return createAreaLight(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.reflectionProbe = function(opts) {
  return createReflectionProbe(
    Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts)
  )
}

Renderer.prototype.skybox = function(opts) {
  return createSkybox(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
}

Renderer.prototype.overlay = function(opts) {
  return createOverlay(Object.assign({ ctx: this._ctx }, opts))
}

Renderer.prototype.loadScene = async function(url, opts = {}) {
  const extension = path.extname(url)

  const [, loader] =
    opts.loader ||
    LOADERS_ENTRIES.find(([extensions]) => extensions.includes(extension)) ||
    []

  if (loader) {
    const scenes = await loader(url, this, opts)
    return scenes.length > 1 ? scenes : scenes[0]
  } else {
    console.error(
      `pex-renderer: No loader found for file extension ${extension}`
    )
  }
}

module.exports = function createRenderer(opts) {
  return new Renderer(opts)
}
