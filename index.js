import { vec3, vec4, mat3, mat4 } from 'pex-math'
import { aabb } from 'pex-geom'
// import Draw from 'pex-draw/Draw'
// import fx from 'pex-fx'
// import AreaLightsData from './AreaLightsData'
import isBrowser from 'is-browser'
import createProfiler from './profiler'
import createEntity from './entity'
import createTransform from './transform'
import createSkin from './skin'
import createMorph from './morph'
import createAnimation from './animation'
import createGeometry from './geometry'
import createMaterial from './material'
import createCamera from './camera'
import createOrbiter from './orbiter'
import createAmbientLight from './ambient-light'
import createDirectionalLight from './directional-light'
import createPointLight from './point-light'
import createSpotLight from './spot-light'
import createAreaLight from './area-light'
import createReflectionProbe from './reflection-probe'
import createSkybox from './skybox'
import createOverlay from './overlay'

// pex-fx extensions, extending FXStage
//import './Postprocess'
//import './BilateralBlur'
//import './SSAO'

import DEPTH_PASS_VERT from './glsl/DepthPass.vert'
import DEPTH_PASS_FRAG from './glsl/DepthPass.frag'
import OVERLAY_VERT from './glsl/Overlay.vert'
import OVERLAY_FRAG from './glsl/Overlay.frag'
import ERROR_VERT from './glsl/Error.vert'
import ERROR_FRAG from './glsl/Error.frag'
import PBR_VERT from './glsl/PBR.vert'
import PBR_FRAG from './glsl/PBR.frag'
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_VERT = glsl(__dirname + '/glsl/SolidColor.vert')
// var SOLID_COLOR_FRAG = fs.readFileSync(__dirname + '/glsl/SolidColor.frag', 'utf8')
// var SHOW_COLORS_VERT = fs.readFileSync(__dirname + '/glsl/ShowColors.vert', 'utf8')
// var SHOW_COLORS_FRAG = fs.readFileSync(__dirname + '/glsl/ShowColors.frag', 'utf8')


const State = {
  frame: 0,
  shadowQuality: 2,
  debug: false,
  profile: false,
  profiler: null,
  paused: false
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
class Renderer {
  constructor(opts) {
    this.entities = []
    this.root = this.entity()

    // check if we passed gl context or options object
    opts = opts.texture2D ? { ctx: opts } : opts

    this._ctx = opts.ctx

    const gl = opts.ctx.gl
    gl.getExtension('OES_standard_derivatives')

    // this._debugDraw = new Draw(ctx)
    this._debug = false

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
  }

  updateDirectionalLightShadowMap(light, geometries) {
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
    const bboxPointsInLightSpace = shadowBboxPoints.map(p =>
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

  // TODO: how fast is building these flag strings every frame for every object?
  getMaterialProgram(geometry, material, skin, options) {
    const ctx = this._ctx

    if (!this._programCache) {
      this._programCache = {}
    }

    let flags = []

    if (!geometry._attributes.aNormal) {
      flags.push('#define USE_UNLIT_WORKFLOW')
    } else {
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
      flags.push(`#define NUM_JOINTS ${skin.joints.length}`)
    }
    if (ctx.capabilities.multipleRenderTargets) {
      flags.push('#define USE_DRAW_BUFFERS')
    }

    if (options.depthPassOnly) {
      const hash = `DEPTH_PASS_ONLY_${flags.join('-')}`
      let program = this._programCache[hash]
      flags = `${flags.join('\n')}\n`
      if (!program) {
        try {
          program = this._programCache[hash] = ctx.program({
            vert: flags + DEPTH_PASS_VERT,
            frag: flags + DEPTH_PASS_FRAG
          })
        } catch (e) {
          console.log('pex-renderer glsl error', e)
          program = this._programCache[hash] = ctx.program({ vert: ERROR_VERT, frag: ERROR_FRAG })
        }
      }
      return program
    }

    flags.push(`#define SHADOW_QUALITY ${material.receiveShadows ? State.shadowQuality : 0}`)

    let useSpecularGlossinessWorkflow = false

    if (material.baseColorMap) {
      flags.push('#define USE_BASE_COLOR_MAP')
      if (!material.baseColor) {
        material.baseColor = [1, 1, 1, 1]
      }
    }
    if (material.metallicMap) {
      flags.push('#define USE_METALLIC_MAP')
      if (isNil(material.metallic)) {
        material.metallic = 1
      }
    }
    if (material.roughnessMap) {
      flags.push('#define USE_ROUGHNESS_MAP')
      if (isNil(material.roughness)) {
        material.roughness = 1
      }
    }
    if (material.metallicRoughnessMap) {
      flags.push('#define USE_METALLIC_ROUGHNESS_MAP')
      if (isNil(material.metallic)) {
        material.metallic = 1
      }
      if (isNil(material.roughness)) {
        material.roughness = 1
      }
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
    if (material.alphaTest) {
      flags.push('#define USE_ALPHA_TEST')
    }
    if (material.blend) {
      flags.push('#define USE_BLEND')
    }

    if (isNil(material.metallic) && isNil(material.roughness)) {
      if (!flags.includes('#define USE_UNLIT_WORKFLOW')) {
        flags.push('#define USE_UNLIT_WORKFLOW')
      }
    } else if (useSpecularGlossinessWorkflow) {
      flags.push('#define USE_SPECULAR_GLOSSINESS_WORKFLOW')
    } else {
      flags.push('#define USE_METALLIC_ROUGHNESS_WORKFLOW')
    }
    flags.push(`#define NUM_AMBIENT_LIGHTS ${options.numAmbientLights || 0}`)
    flags.push(`#define NUM_DIRECTIONAL_LIGHTS ${options.numDirectionalLights || 0}`)
    flags.push(`#define NUM_POINT_LIGHTS ${options.numPointLights || 0}`)
    flags.push(`#define NUM_SPOT_LIGHTS ${options.numSpotLights || 0}`)
    flags.push(`#define NUM_AREA_LIGHTS ${options.numAreaLights || 0}`)
    if (options.useReflectionProbes) {
      flags.push('#define USE_REFLECTION_PROBES')
    }
    flags = `${flags.join('\n')}\n`

    const vertSrc = flags + (material.vert || PBR_VERT)
    const fragSrc = flags + (material.frag || PBR_FRAG)
    var hash = vertSrc + fragSrc

    var program = this._programCache[hash]
    if (!program) {
      // console.log('added program', vertSrc, fragSrc)
      try {
        program = this._programCache[hash] = ctx.program({ vert: vertSrc, frag: fragSrc })
      } catch (e) {
        console.log('pex-renderer glsl error', e)
        program = this._programCache[hash] = ctx.program({ vert: ERROR_VERT, frag: ERROR_FRAG })
      }
    }
    return program
  }

  traverseTransformTree(transform, beforeCallback, afterCallback) {
    if (!transform.enabled) return
    beforeCallback(transform)
    transform.children.forEach(child => {
      this.traverseTransformTree(child, beforeCallback, afterCallback)
    })
    if (afterCallback) afterCallback(transform)
  }

  update() {
    this.entities = []
    this.traverseTransformTree(
      this.root.transform,
      transform => {
        this.entities.push(transform.entity)
        transform.entity.components.forEach(component => {
          if (component.update) component.update()
        })
      },
      transform => {
        transform.entity.components.forEach(component => {
          if (component.afterUpdate) component.afterUpdate()
        })
      }
    )
  }

  getGeometryPipeline(geometry, material, skin, opts) {
    const ctx = this._ctx
    const program = this.getMaterialProgram(geometry, material, skin, opts)
    if (!this._pipelineCache) {
      this._pipelineCache = {}
    }
    // TODO: better pipeline caching
    const hash = `${material.id}_${program.id}`
    let pipeline = this._pipelineCache[hash]
    if (!pipeline) {
      pipeline = ctx.pipeline({
        program,
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

  getOverlayCommand() {
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
          program,
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

  getComponents(type) {
    const result = []

    for (const entity of this.entities) {
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
  drawMeshes(camera, shadowMapping, shadowMappingLight, geometries, skybox, forward) {
    const ctx = this._ctx

    function byCameraTags(component) {
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
      directionalLights.forEach(light => {
        if (light.castShadows) {
          const shadowCasters = geometries.filter(geometry => {
            const material = geometry.entity.getComponent('Material')
            return material && material.castShadows
          })
          this.updateDirectionalLightShadowMap(light, shadowCasters)
        }
      })
    }

    const sharedUniforms = (this._sharedUniforms = this._sharedUniforms || {})
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
      const far = camera.far
      if (shadowMapping) {
        // TODO: Far clipping plane scaling fixes depth buffer precision artifacts
        // but breaks shadows on large scale scenes (eg maps)
        camera.set({ far: far * 0.99 })
      }
      sharedUniforms.uProjectionMatrix = mat4.copy(camera.projectionMatrix)
      if (shadowMapping) {
        camera.set({ far })
      }
      sharedUniforms.uViewMatrix = camera.viewMatrix
      sharedUniforms.uInverseViewMatrix = mat4.invert(mat4.copy(camera.viewMatrix)) // TODO: GC
    }

    if (camera && camera.ssao) {
      sharedUniforms.uAO = camera._frameAOTex
      sharedUniforms.uScreenSize = [camera.viewport[2], camera.viewport[3]] // TODO: should this be camera viewport size?
    }

    ambientLights.forEach((light, i) => {
      sharedUniforms[`uAmbientLights[${i}].color`] = light.color
    })

    directionalLights.forEach((light, i) => {
      const dir4 = [0, 0, 1, 0] // TODO: GC
      const dir = [0, 0, 0]
      vec4.multMat4(dir4, light.entity.transform.modelMatrix)
      vec3.set(dir, dir4)
      sharedUniforms[`uDirectionalLights[${i}].direction`] = dir
      sharedUniforms[`uDirectionalLights[${i}].color`] = light.color
      sharedUniforms[`uDirectionalLights[${i}].projectionMatrix`] = light._projectionMatrix
      sharedUniforms[`uDirectionalLights[${i}].viewMatrix`] = light._viewMatrix
      sharedUniforms[`uDirectionalLights[${i}].near`] = light._near
      sharedUniforms[`uDirectionalLights[${i}].far`] = light._far
      sharedUniforms[`uDirectionalLights[${i}].bias`] = light.bias
      sharedUniforms[`uDirectionalLights[${i}].shadowMapSize`] = [
        light._shadowMap.width,
        light._shadowMap.height
      ]
      sharedUniforms[`uDirectionalLightShadowMaps[${i}]`] = light._shadowMap
    })

    pointLights.forEach((light, i) => {
      sharedUniforms[`uPointLights[${i}].position`] = light.entity.transform.worldPosition
      sharedUniforms[`uPointLights[${i}].color`] = light.color
      sharedUniforms[`uPointLights[${i}].range`] = light.range
    })

    spotLights.forEach((light, i) => {
      const transform = light.entity.transform
      const position = transform.worldPosition
      const target = light.target
      const dir = vec3.normalize(vec3.sub(vec3.copy(target), position))
      sharedUniforms[`uSpotLights[${i}].position`] = light.entity.transform.position
      sharedUniforms[`uSpotLights[${i}].direction`] = dir
      sharedUniforms[`uSpotLights[${i}].color`] = light.color
      sharedUniforms[`uSpotLights[${i}].angle`] = light.angle
      sharedUniforms[`uSpotLights[${i}].range`] = light.range
    })

    areaLights.forEach((light, i) => {
      sharedUniforms.ltc_mat = light.ltc_mat_texture
      sharedUniforms.ltc_mag = light.ltc_mag_texture
      sharedUniforms[`uAreaLights[${i}].position`] = light.entity.transform.position
      sharedUniforms[`uAreaLights[${i}].color`] = light.color
      sharedUniforms[`uAreaLights[${i}].intensity`] = light.intensity // FIXME: why area light has intensity and other lights don't?
      sharedUniforms[`uAreaLights[${i}].rotation`] = light.entity.transform.rotation
      sharedUniforms[`uAreaLights[${i}].size`] = [
        light.entity.transform.scale[0] / 2,
        light.entity.transform.scale[1] / 2
      ]
    })

    geometries.sort((a, b) => {
      const matA = a.entity.getComponent('Material')
      const matB = b.entity.getComponent('Material')
      const transparentA = matA.blend ? 1 : 0
      const transparentB = matB.blend ? 1 : 0
      return transparentA - transparentB
    })

    const firstTransparent = geometries.findIndex(g => g.entity.getComponent('Material').blend)

    // also drawn below if transparent objects don't exist
    for (const geometry of geometries) {
      const transform = geometry.entity.transform
      if (!transform.enabled) continue
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

      if (material.metallicMap) cachedUniforms.uMetallicMap = material.metallicMap
      if (!isNil(material.metallic)) cachedUniforms.uMetallic = material.metallic

      if (material.roughnessMap) cachedUniforms.uRoughnessMap = material.roughnessMap
      if (!isNil(material.roughness)) cachedUniforms.uRoughness = material.roughness

      if (material.metallicRoughnessMap)
        cachedUniforms.uMetallicRoughnessMap = material.metallicRoughnessMap

      if (material.diffuse) cachedUniforms.uDiffuse = material.diffuse
      if (material.specular) cachedUniforms.uSpecular = material.specular
      if (material.glossiness !== undefined) cachedUniforms.uGlossiness = material.glossiness
      if (material.diffuseMap) cachedUniforms.uDiffuseMap = material.diffuseMap
      if (material.specularGlossinessMap)
        cachedUniforms.uSpecularGlossinessMap = material.specularGlossinessMap

      if (material.normalMap) cachedUniforms.uNormalMap = material.normalMap
      if (material.occlusionMap) cachedUniforms.uOcclusionMap = material.occlusionMap
      if (material.displacementMap) {
        cachedUniforms.uDisplacementMap = material.displacementMap
        cachedUniforms.uDisplacement = material.displacement
      }

      if (material.uniforms) {
        for (const uniformName in material.uniforms) {
          cachedUniforms[uniformName] = material.uniforms[uniformName]
        }
      }

      if (skin) {
        cachedUniforms.uJointMat = skin.jointMatrices
      }

      let pipeline = null
      if (shadowMapping) {
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
      let viewMatrix
      if (shadowMappingLight) {
        viewMatrix = shadowMappingLight._viewMatrix
      } else {
        viewMatrix = camera.viewMatrix
      }
      const normalMat = mat4.copy(viewMatrix)
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
        pipeline,
        uniforms: cachedUniforms,
        instances: geometry.instances
      })
    }

    // also drawn above if transparent objects exist
    if (firstTransparent === -1 && skybox) {
      skybox.draw(camera, {
        outputEncoding: sharedUniforms.uOutputEncoding,
        diffuse: true
      })
    }
  }

  draw() {
    const ctx = this._ctx

    if (State.paused) return

    this.update()

    if (State.profiler) State.profiler.startFrame()

    const cameras = this.getComponents('Camera')
    const overlays = this.getComponents('Overlay')
    const skyboxes = this.getComponents('Skybox')
    const reflectionProbes = this.getComponents('ReflectionProbe')

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
    reflectionProbes.forEach(probe => {
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
      if (State.profiler) State.profiler.time('depthPrepass', true)
      if (camera.postprocess) {
        ctx.submit(camera._drawFrameNormalsFboCommand, () => {
          // depth prepass
          this.drawMeshes(camera, true)
        })
      }
      if (State.profiler) State.profiler.timeEnd('depthPrepass')
      if (camera.ssao) {
        if (State.profiler) State.profiler.time('ssao', true)
        ctx.submit(camera._ssaoCmd, {
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

    overlays.forEach(overlay => {
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

  // TODO: remove unused code
  drawDebug() {
    const ctx = this._ctx

    const directionalLightNodes = this._directionalLightNodes
    ctx.bindProgram(this._showColorsProgram)
    this._debugDraw.setColor([1, 0, 0, 1])

    this._debugDraw.setLineWidth(2)
    directionalLightNodes.forEach(lightNode => {
      const light = lightNode.data.light
      const invProj = mat4.invert(mat4.copy(light._projectionMatrix))
      const invView = mat4.invert(mat4.copy(light._viewMatrix))
      const corners = [
        [-1, -1, 1, 1],
        [1, -1, 1, 1],
        [1, 1, 1, 1],
        [-1, 1, 1, 1],
        [-1, -1, -1, 1],
        [1, -1, -1, 1],
        [1, 1, -1, 1],
        [-1, 1, -1, 1]
      ].map(p => {
        const v = vec4.multMat4(vec4.multMat4(vec4.copy(p), invProj), invView)
        vec3.scale(v, 1 / v[3])
        return v
      })

      const position = lightNode.data.position
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
    })

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

  entity(components, tags) {
    return createEntity(components, tags)
  }

  add(entity, parent) {
    // console.warn('pex-renderer: renderer.add() is deprecated')
    if (entity === this.root) {
      return entity
    }
    entity.transform.set({
      parent: parent ? parent.transform : entity.transform.parent || this.root.transform
    })
    return entity
  }

  remove(entity) {
    entity.transform.set({ parent: null })
  }

  transform(opts) {
    return createTransform(Object.assign({ ctx: this._ctx }, opts))
  }

  skin(opts) {
    return createSkin(Object.assign({ ctx: this._ctx }, opts))
  }

  morph(opts) {
    return createMorph(Object.assign({ ctx: this._ctx }, opts))
  }

  animation(opts) {
    return createAnimation(Object.assign({ ctx: this._ctx }, opts))
  }

  geometry(opts) {
    return createGeometry(Object.assign({ ctx: this._ctx }, opts))
  }

  material(opts) {
    return createMaterial(Object.assign({ ctx: this._ctx }, opts))
  }

  camera(opts) {
    return createCamera(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
  }

  orbiter(opts) {
    return createOrbiter(Object.assign({ ctx: this._ctx }, opts))
  }

  ambientLight(opts) {
    return createAmbientLight(Object.assign({ ctx: this._ctx }, opts))
  }

  directionalLight(opts) {
    return createDirectionalLight(Object.assign({ ctx: this._ctx }, opts))
  }

  pointLight(opts) {
    return createPointLight(Object.assign({ ctx: this._ctx }, opts))
  }

  spotLight(opts) {
    return createSpotLight(Object.assign({ ctx: this._ctx }, opts))
  }

  areaLight(opts) {
    return createAreaLight(Object.assign({ ctx: this._ctx }, opts))
  }

  reflectionProbe(opts) {
    return createReflectionProbe(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
  }

  skybox(opts) {
    return createSkybox(Object.assign({ ctx: this._ctx, rgbm: State.rgbm }, opts))
  }

  overlay(opts) {
    return createOverlay(Object.assign({ ctx: this._ctx }, opts))
  }
}

export default function createRenderer(opts) {
  return new Renderer(opts)
}
