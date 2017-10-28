const loadJSON = require('pex-io/loadJSON')
const loadText = require('pex-io/loadText')
const loadImage = require('pex-io/loadImage')
const createCube = require('primitive-cube')
const createBox = require('primitive-box')
const loadBinary = require('pex-io/loadBinary')
const Mat4 = require('pex-math/Mat4')
const Vec3 = require('pex-math/Vec3')
const AABB = require('pex-geom/AABB')
const createRenderer = require('../../../pex-renderer')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createContext = require('pex-context')
const async = require('async')
const path = require('path')
const GUI = require('pex-gui')
const edges = require('geom-edges')
const isPOT = require('is-power-of-two')
const nextPOT = require('next-power-of-two')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 4,
  pauseOnBlur: true
})

const gui = new GUI(ctx)
gui.addHeader('Settings')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  selectedModel: '',
  animations: [],
  entities: []
}

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(State.sunPosition, 10, 0, 0)
  Vec3.multMat4(State.sunPosition, State.elevationMat)
  Vec3.multMat4(State.sunPosition, State.rotationMat)

  if (State.sun) {
    var sunDir = State.sun.direction
    Vec3.set(sunDir, [0, 0, 0])
    Vec3.sub(sunDir, State.sunPosition)
    State.sun.set({ direction: sunDir })
  }

  if (State.skybox) {
    State.skybox.set({ sunPosition: State.sunPosition })
  }

  if (State.reflectionProbe) {
    State.reflectionProbe.dirty = true // FIXME: hack
  }
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    direction: Vec3.sub(Vec3.create(), State.sunPosition),
    color: [1, 1, 0.95, 1],
    intensity: 10,
    castShadows: true
  })

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition
  })

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })

  renderer.add(renderer.entity([ sun ])).name = 'sun'
  renderer.add(renderer.entity([ skybox ])).name = 'skybox'
  renderer.add(renderer.entity([ reflectionProbe ])).name = 'reflectionProbe'

  updateSunPosition()
}

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 2, 4],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  renderer.add(renderer.entity([
    renderer.camera({
      camera: camera,
      // dof: true,
      dofIterations: 1,
      dofRange: 0.5,
      dofRadius: 1,
      dofDepth: 1,
      ssao: true,
      ssaoIntensity: 5,
      ssaoRadius: 6,
      ssaoBias: 0.02,
      ssaoBlurRadius: 0.05, // 2
      ssaoBlurSharpness: 10// 10,
      // ssaoRadius: 5,
    })
  ])).name = 'camera'
}

initSky()
initCamera()
let debugOnce = false

var WebGLConstants = {
  ELEMENT_ARRAY_BUFFER: 34963,  // 0x8893
  ARRAY_BUFFER: 34962,          // 0x8892
  UNSIGNED_SHORT: 5123,         // 0x1403
  UNSIGNED_INT: 5125,
  FLOAT: 5126,                  // 0x1406
  TRIANGLES: 4,                 // 0x0004
  SAMPLER_2D: 35678,            // 0x8B5E
  FLOAT_VEC2: 35664,            // 0x8B50
  FLOAT_VEC3: 35665,            // 0x8B51
  FLOAT_VEC4: 35666,            // 0x8B52
  FLOAT_MAT4: 35676             // 0x8B5C
}

const AttributeSizeMap = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16
}

const AttributeNameMap = {
  POSITION: 'positions',
  NORMAL: 'normals',
  TEXCOORD_0: 'texCoords',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights'
}

function handleBufferView (bufferView, bufferData) {
  if (bufferView.byteOffset === undefined) bufferView.byteOffset = 0
  bufferView.data = bufferData.slice(
    bufferView.byteOffset,
    bufferView.byteOffset + bufferView.byteLength
  )
}

function handleAccessor (accessor, bufferView) {
  const size = AttributeSizeMap[accessor.type]
  if (accessor.byteOffset === undefined) accessor.byteOffset = 0

  if (accessor.componentType === WebGLConstants.UNSIGNED_SHORT) {
    const data = new Uint16Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 2
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.UNSIGNED_INT) {
    const data = new Uint32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT) {
    const data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC2) {
    const data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC3) {
    const data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.FLOAT_VEC4) {
    const data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else {
    // TODO
    console.log('uncaught', accessor)
  }
}

// TODO: add texture cache so we don't load the same texture twice
function loadTexture (materialTexture, gltf, basePath, encoding, cb) {
  let texture = gltf.textures[materialTexture.index]
  let image = gltf.images[texture.source]
  let sampler = gltf.samplers ? gltf.samplers[texture.sampler] : {
    minFilter: ctx.Filter.Linear,
    magFilter: ctx.Filter.Linear
  }
  // set defaults as per GLTF 2.0 spec
  if (!sampler.wrapS) sampler.wrapS = ctx.Wrap.Repeat
  if (!sampler.wrapT) sampler.wrapT = ctx.Wrap.Repeat

  let url = path.join(basePath, image.uri)
  loadImage(url, (err, img) => {
    if (err) return cb(err, null)
    if (!isPOT(img.width) || !isPOT(img.height)) {
      // FIXME: this is WebGL1 limitation
      if (sampler.wrapS !== ctx.Wrap.Clamp || sampler.wrapT !== ctx.Wrap.Clamp || (sampler.minFilter !== ctx.Filter.Nearest && sampler.minFilter !== ctx.Filter.Linear)) {
        const nw = nextPOT(img.width)
        const nh = nextPOT(img.height)
        console.log(`Warning: NPOT Repeat Wrap mode and mipmapping is not supported for NPOT Textures. Resizing... ${img.width}x${img.height} -> ${nw}x${nh}`)
        var canvas2d = document.createElement('canvas')
        canvas2d.width = nw
        canvas2d.height = nh
        var ctx2d = canvas2d.getContext('2d')
        ctx2d.drawImage(img, 0, 0, canvas2d.width, canvas2d.height)
        img = canvas2d
      }
    }
    var tex = ctx.texture2D({
      data: img,
      width: img.width,
      height: img.height,
      encoding: ctx.Encoding.SRGB,
      pixelFormat: ctx.PixelFormat.RGBA8,
      wrapS: sampler.wrapS,
      wrapT: sampler.wrapT,
      min: sampler.minFilter,
      mag: sampler.magFilter,
      flipY: false // this is confusing as
    })
    if (sampler.minFilter !== ctx.Filter.Nearest && sampler.minFilter !== ctx.Filter.Linear) {
      ctx.update(tex, { mipmap: true })
    }
    cb(null, tex)
  })
}

function handleMaterial (material, gltf, basePath) {
  const materialCmp = renderer.material({
    baseColor: [1, 1, 1, 1.0],
    roughness: 1.0,
    metallic: 0.0,
    castShadows: true,
    receiveShadows: true,
    cullFaceEnabled: !material.doubleSided
  })

  const pbrMetallicRoughness = material.pbrMetallicRoughness
  if (pbrMetallicRoughness) {
    if (pbrMetallicRoughness.baseColorTexture) {
      loadTexture(pbrMetallicRoughness.baseColorTexture, gltf, basePath, ctx.Encoding.SRGB, (err, tex) => {
        if (err) throw err
        materialCmp.set({ baseColorMap: tex })
      })
    }
    if (pbrMetallicRoughness.metallicRoughnessTexture) {
      loadTexture(pbrMetallicRoughness.metallicRoughnessTexture, gltf, basePath, ctx.Encoding.Linear, (err, tex) => {
        if (err) throw err
        materialCmp.set({ metallicRoughnessMap: tex })
      })
    }
    if (pbrMetallicRoughness.baseColorFactor) {
      materialCmp.set({ baseColor: pbrMetallicRoughness.baseColorFactor })
    }
  }

  const pbrSpecularGlossiness = material.extensions ? material.extensions.KHR_materials_pbrSpecularGlossiness : null
  if (pbrSpecularGlossiness) {
    if (pbrSpecularGlossiness.diffuseTexture) {
      console.log('handleMaterial.diffuseTexture')
      loadTexture(pbrSpecularGlossiness.diffuseTexture, gltf, basePath, ctx.Encoding.SRGB, (err, tex) => {
        if (err) throw err
        materialCmp.set({ baseColorMap: tex })
      })
    }
  }

  if (material.normalTexture) {
    loadTexture(material.normalTexture, gltf, basePath, ctx.Encoding.Linear, (err, tex) => {
      if (err) throw err
      materialCmp.set({ normalMap: tex })
    })
  }

  if (material.emissiveTexture) {
    // TODO: double check sRGB
    loadTexture(material.emissiveTexture, gltf, basePath, ctx.Encoding.SRGB, (err, tex) => {
      if (err) throw err
      materialCmp.set({ emissiveColorMap: tex })
    })
  }

  return materialCmp
}

function handleMesh (mesh, gltf, basePath) {
  return mesh.primitives.map((primitive) => {
    const attributes = Object.keys(primitive.attributes).reduce((attributes, name) => {
      const accessor = gltf.accessors[primitive.attributes[name]]
      attributes[AttributeNameMap[name]] = accessor.data
      return attributes
    }, {})

    console.log('handleMesh.attributes', attributes)

    const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
    const indicesAccessor = gltf.accessors[primitive.indices]
    console.log('handleMesh.positionAccessor', positionAccessor)
    console.log('handleMesh.indicesAccessor', indicesAccessor)

    const geometryCmp = renderer.geometry(attributes)
    geometryCmp.set({
      bounds: [positionAccessor.min, positionAccessor.max]
    })

    if (indicesAccessor) {
      geometryCmp.set({
        indices: indicesAccessor.data
      })
    } else {
      geometryCmp.set({
        count: positionAccessor.data.length / 3
      })
    }

    let materialCmp = null
    if (primitive.material !== undefined) {
      const material = gltf.materials[primitive.material]
      materialCmp = handleMaterial(material, gltf, basePath)
    } else {
      materialCmp = renderer.material({})
    }

    let components = [
      geometryCmp,
      materialCmp
    ]

    if (primitive.targets) {
      let targets = primitive.targets.map((target) => {
        return gltf.accessors[target.POSITION].data
      })
      let morphCmp = renderer.morph({
        // TODO the rest ?
        targets: targets,
        weights: mesh.weights
      })
      components.push(morphCmp)
    }

    return components
  })
}

function handleNode (node, gltf, basePath, i) {
  const transform = {
    position: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1]
  }
  if (node.matrix) transform.matrix = node.matrix
  const transformCmp = renderer.transform(transform)

  node.entity = renderer.add(renderer.entity([
    transformCmp
  ]))
  node.entity.name = node.name || ('node_' + i)

  let skinCmp = null
  if (node.skin !== undefined) {
    const skin = gltf.skins[node.skin]
    const data = gltf.accessors[skin.inverseBindMatrices].data

    let inverseBindMatrices = []
    for (let i = 0; i < data.length; i += 16) {
      inverseBindMatrices.push(data.slice(i, i + 16))
    }

    skinCmp = renderer.skin({
      inverseBindMatrices: inverseBindMatrices
    })
  }

  if (node.mesh !== undefined) {
    const primitives = handleMesh(gltf.meshes[node.mesh], gltf, basePath)
    if (primitives.length === 1) {
      primitives[0].forEach((component) => {
        node.entity.addComponent(component)
      })
      if (skinCmp) node.entity.addComponent(skinCmp)
      return node.entity
    } else {
      // create sub modes for each primitive
      const primitiveNodes = primitives.map((components, j) => {
        const subMesh = renderer.add(renderer.entity(components))
        subMesh.name = `node_${i}_${j}`
        subMesh.transform.set({ parent: node.entity.transform })

        // TODO: should skin component be shared?
        if (skinCmp) subMesh.addComponent(skinCmp)
        return subMesh
      })
      const nodes = [node.entity].concat(primitiveNodes)
      return nodes
    }
  }
  return node.entity
}

function buildHierarchy (nodes, gltf) {
  nodes.forEach((node, index) => {
    let parent = nodes[index]
    if (!parent || !parent.entity) return // TEMP: for debuggin only, child should always exist
    let parentTransform = parent.entity.transform
    if (node.children) {
      node.children.forEach((childIndex) => {
        let child = nodes[childIndex]
        if (!child || !child.entity) return // TEMP: for debuggin only, child should always exist
        let childTransform = child.entity.transform
        childTransform.set({ parent: parentTransform })
      })
    }
  })

  nodes.forEach((node) => {
    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]

      const joints = skin.joints.map((i) => {
        return nodes[i].entity
      })

      if (gltf.meshes[node.mesh].primitives.length === 1) {
        node.entity.getComponent('Skin').set({
          joints: joints
        })
      } else {
        node.entity.transform.children.forEach((child) => {
          // FIXME: currently we share the same Skin component
          // so this code is redundant after first child
          child.entity.getComponent('Skin').set({
            joints: joints
          })
        })
      }
    }
  })
}

function handleBuffer (buffer, cb) {
  if (!buffer.uri) {
    cb(new Error('gltf buffer.uri does not exist'))
    return
  }
  loadBinary(buffer.uri, function (err, data) {
    buffer.data = data
    cb(err, data)
  })
}

function handleAnimation (animation, gltf) {
  return animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler]
    const input = gltf.accessors[sampler.input]
    const output = gltf.accessors[sampler.output]
    const target = gltf.nodes[channel.target.node].entity

    const outputData = []
    const od = output.data
    let offset = AttributeSizeMap[output.type]
    if (channel.target.path === 'weights') {
      offset = target.getComponent('Morph').weights.length
    }
    for (let i = 0; i < output.data.length; i += offset) {
      if (offset === 1) {
        outputData.push([od[i]])
      }
      if (offset === 2) {
        outputData.push([od[i], od[i + 1]])
      }
      if (offset === 3) {
        outputData.push([od[i], od[i + 1], od[i + 2]])
      }
      if (offset === 4) {
        outputData.push([od[i], od[i + 1], od[i + 2], od[i + 3]])
      }
    }

    return {
      sampler: {
        input: input.data,
        output: outputData,
        interpolation: sampler.interpolation
      },
      target: {
        node: target,
        path: channel.target.path
      }
    }
  })
}

function loadScreenshot (name, cb) {
  const extensions = ['png', 'jpg', 'jpeg', 'gif']

  function tryNextExt () {
    const ext = extensions.shift()
    if (!ext) cb(new Error('Failed to load screenshot for ' + name), null)
    const url = `assets/gltf-sample-models/${name}/screenshot/screenshot.${ext}`
    console.log('trying to load ' + url)
    loadImage(url, (err, img) => {
      if (err) tryNextExt()
      else cb(null, img)
    })
  }
  console.log('trying to load ' + name)
  tryNextExt()
}

const indexFile = 'assets/gltf-sample-models/index.txt'
loadText(indexFile, (err, text) => {
  if (err) throw new Error(err)
  const modelNames = text.split('\n')
  async.map(modelNames, loadScreenshot, function (err, screenshots) {
    if (err) console.log('screenshots error', err)
    if (err) throw new Error(err)

    var thumbnails = screenshots.map((img) => {
      return ctx.texture2D({
        data: img,
        width: img.width,
        height: img.height,
        encoding: ctx.Encoding.SRGB,
        pixelFormat: ctx.PixelFormat.RGBA8,
        flipY: true
      })
    })
    gui.addTexture2DList('Models', State, 'selectedModel', thumbnails.map((tex, i) => {
      return {
        value: modelNames[i],
        texture: tex
      }
    }), 4, (model) => {
      console.log('model', model)
      loadModel(`assets/gltf-sample-models/${model}/glTF/${model}.gltf`)
    })
    console.log('screenshots', screenshots)

    var defaultModel = modelNames[19]
    loadModel(`assets/gltf-sample-models/${defaultModel}/glTF/${defaultModel}.gltf`)
    // loadModel(`assets/gltf/skull_downloadable/scene.gltf`)
    // loadModel(`assets/gltf/damagedHelmet/damagedHelmet.gltf`)
    // loadModel(`assets/gltf/hover_bike/scene.gltf`)
  })
})

function aabbToString (aabb) {
  if (AABB.isEmpty(aabb)) return '[]'
  return `[${aabb.map((v) => v.map((f) => f.toFixed(2)).join(', ')).join(', ')}]`
}

function loadModel (file) {
  console.log('loadModel', file)

  State.animations = []

  // TODO: destroy materials and textures
  State.entities.forEach((e) => {
    renderer.remove(e)
  })
  State.entities = []

  loadJSON(file, (err, gltf) => {
    if (err) throw new Error(err)
    const basePath = path.dirname(file)

    gltf.buffers.forEach((buffer) => {
      buffer.uri = path.join(basePath, buffer.uri)
    })

    async.map(gltf.buffers, handleBuffer, function (err, res) {
      if (err) throw new Error(err)

      gltf.bufferViews.map((bufferView) => {
        handleBufferView(bufferView, gltf.buffers[bufferView.buffer].data)
      })

      gltf.accessors.map((accessor) => {
        handleAccessor(accessor, gltf.bufferViews[accessor.bufferView])
      })

      const sceneRoot = renderer.add(renderer.entity())
      renderer.root.name = 'root'
      sceneRoot.name = 'sceneRoot'
      State.entities = gltf.nodes.reduce((entities, node, i) => {
        const result = handleNode(node, gltf, basePath, i)
        if (result.length) {
          result.forEach((primitive) => entities.push(primitive))
        } else {
          entities.push(result)
        }
        return entities
      }, [])

      console.log('entities', State.entities)

      buildHierarchy(gltf.nodes, gltf)

      State.entities.forEach((e) => {
        if (e.transform.parent === renderer.root.transform) {
          console.log('attaching to scene root', e)
          e.transform.set({ parent: sceneRoot.transform })
        }
      })

      // prune non geometry nodes (cameras, lights, etc) from the hierarchy
      State.entities.forEach((e) => {
        if (e.getComponent('Geometry')) {
          e.used = true
          while (e.transform.parent) {
            e = e.transform.parent.entity
            e.used = true
          }
        }
      })
      if (gltf.skins) {
        gltf.skins.forEach((skin) => {
          skin.joints.forEach((jointIndex) => {
            let e = State.entities[jointIndex]
            e.used = true
            while (e.transform.parent) {
              e = e.transform.parent.entity
              e.used = true
            }
          })
        })
      }
      // State.entities = State.entities.filter((e) => {
        // if (!e.used) renderer.remove(e)
        // return e.used
      // })
      console.log('entities pruned', State.entities)

      renderer.update() // refresh scene hierarchy

      const sceneBounds = sceneRoot.transform.worldBounds
      const sceneSize = AABB.size(sceneRoot.transform.worldBounds)
      const sceneCenter = AABB.center(sceneRoot.transform.worldBounds)
      const sceneScale = 1 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1)
      if (!AABB.isEmpty(sceneBounds)) {
        sceneRoot.transform.set({
          position: Vec3.scale([-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]], sceneScale),
          scale: [sceneScale, sceneScale, sceneScale]
        })
      }

      renderer.update() // refresh scene hierarchy

      State.entities.push(sceneRoot)

      function printEntity (e, level, s) {
        s = s || ''
        level = '  ' + (level || '')
        var g = e.getComponent('Geometry')
        s += level + (e.name || 'child') + ' ' + aabbToString(e.transform.worldBounds) + ' ' + aabbToString(e.transform.bounds) + ' ' + (g ? aabbToString(g.bounds) : '') + '\n'
        if (e.transform) {
          e.transform.children.forEach((c) => {
            s = printEntity(c.entity, level, s)
          })
        }
        return s
      }

      const showBoundingBoxes = false
      if (showBoundingBoxes) {
        const bboxes = State.entities.map((e) => {
          var size = AABB.size(e.transform.worldBounds)
          var center = AABB.center(e.transform.worldBounds)

          const bbox = renderer.add(renderer.entity([
            renderer.transform({
              scale: size,
              position: center
            }),
            renderer.geometry(box),
            renderer.material({
              baseColor: [1, 0, 0, 1]
            })
          ]))
          bbox.name = e.name + '_bbox'
          return bbox
        }).filter((e) => e)
        State.entities = State.entities.concat(bboxes)
      }

      console.log('sceneRoot children', sceneRoot.transform.children.length)
      console.log(printEntity(renderer.root))

      if (gltf.animations) {
        State.animations = State.animations.concat(gltf.animations.map((animation) => {
          return handleAnimation(animation, gltf)
        }))
      }
    })
  })
}

var startTime = Date.now()

const floor = renderer.add(renderer.entity([
  renderer.transform({
    position: [0, -0.05, 0]
  }),
  renderer.geometry(createCube(5, 0.1, 5)),
  renderer.material({
    baseColor: [0.5, 0.5, 0.5, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
floor.name = 'floor'

const originX = renderer.add(renderer.entity([
  renderer.transform({
    position: [1, 0, 0]
  }),
  renderer.geometry(createCube(2, 0.02, 0.02)),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originX.name = 'originX'

const originY = renderer.add(renderer.entity([
  renderer.transform({
    position: [0, 1, 0]
  }),
  renderer.geometry(createCube(0.02, 2, 0.02)),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originY.name = 'originY'

const originZ = renderer.add(renderer.entity([
  renderer.transform({
    position: [0, 0, 1]
  }),
  renderer.geometry(createCube(0.02, 0.02, 2)),
  renderer.material({
    baseColor: [0, 0, 1, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originZ.name = 'origin~'

var box = createBox(1)
box.cells = edges(box.cells)
box.primitive = ctx.Primitive.Lines

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  if (!renderer._state.paused) {
    gui.draw()
  }

  var elapsedTime = Date.now() - startTime
  var ms = (elapsedTime / 1000).toFixed(3)

  State.animations.forEach((channels, i) => {
    channels.forEach((channel) => {
      const inputData = channel.sampler.input
      const outputData = channel.sampler.output
      const target = channel.target.node
      const path = channel.target.path

      let prevInput = null
      let nextInput = null
      let prevOutput = null
      let nextOutput = null

      const animationLength = inputData[inputData.length - 1]
      const currentTime = ms % animationLength

      let prevIndex
      let nextIndex

      for (var i = 0; i < inputData.length; i++) {
        nextIndex = i
        if (inputData[i] >= currentTime) {
          break
        }
        prevIndex = nextIndex
      }

      if (prevIndex !== undefined) {
        prevInput = inputData[prevIndex]
        nextInput = inputData[nextIndex]
        prevOutput = outputData[prevIndex]
        nextOutput = outputData[nextIndex]

        const interpolationValue = ((currentTime) - prevInput) / (nextInput - prevInput)

        const currentOutput = []
        for (var k = 0; k < nextOutput.length; k++) {
          currentOutput[k] =
            prevOutput[k] + interpolationValue * (nextOutput[k] - prevOutput[k])
        }

        if (path === 'translation') {
          target.transform.set({
            position: currentOutput
          })
        } else if (path === 'rotation') {
          target.transform.set({
            rotation: currentOutput
          })
        } else if (path === 'rotation') {
          target.transform.set({
            rotation: currentOutput
          })
        } else if (path === 'weights') {
          target.getComponent('Morph').set({
            weights: nextOutput
          })
        }
      }
    })
  })
})
