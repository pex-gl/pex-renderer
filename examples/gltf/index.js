const loadJSON = require('pex-io/loadJSON')
const loadText = require('pex-io/loadText')
const loadImage = require('pex-io/loadImage')
const createCube = require('primitive-cube')
const loadBinary = require('pex-io/loadBinary')
const Mat4 = require('pex-math/Mat4')
const Vec3 = require('pex-math/Vec3')
const createRenderer = require('../../')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createContext = require('pex-context')
const async = require('async')
const path = require('path')
const GUI = require('pex-gui')

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

  renderer.add(renderer.entity([ sun ]))
  renderer.add(renderer.entity([ skybox ]))
  renderer.add(renderer.entity([ reflectionProbe ]))

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
    renderer.camera({ camera: camera })
  ]))
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
  VEC4: 4,
  VEC3: 3,
  VEC2: 2,
  MAT4: 16
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
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === WebGLConstants.UNSIGNED_INT) {
    // TODO: Is this valide buffer type?
    const data = new Uint16Array(bufferView.data.slice(
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

function handleNode (node, gltf, basePath) {
  const transform = {
    position: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1]
  }
  if (node.matrix) transform.matrix = node.matrix

  const transformCmp = renderer.transform(transform)
  if (node.mesh !== undefined) {
    const mesh = gltf.meshes[node.mesh]
    const primitive = mesh.primitives[0]
    const attributes = primitive.attributes

    const positionAccessor = gltf.accessors[attributes.POSITION]
    const normalAccessor = gltf.accessors[attributes.NORMAL]
    const texCoord0Accessor = gltf.accessors[attributes.TEXCOORD_0]
    const indicesAccessor = gltf.accessors[primitive.indices]
    const geometryCmp = renderer.geometry({
      positions: positionAccessor.data,
      normals: normalAccessor.data,
      texCoords: texCoord0Accessor.data,
      indices: indicesAccessor.data,
      bounds: [positionAccessor.min, positionAccessor.max]
    })

    const jointAccessor = gltf.accessors[mesh.primitives[0].attributes.JOINTS_0]
    if (jointAccessor) geometryCmp.set({ joints: jointAccessor.data })
    const weightAccessor = gltf.accessors[mesh.primitives[0].attributes.WEIGHTS_0]
    if (weightAccessor) geometryCmp.set({ weights: weightAccessor.data })

    const materialCmp = renderer.material({
      baseColor: [1, 1, 1, 1.0],
      roughness: 1,
      metallic: 0,
      castShadows: true,
      receiveShadows: true
    })

    if (primitive.material !== undefined) {
      const material = gltf.materials[primitive.material]
      let baseColorTexture = gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index]
      // TODO: sampler
      let baseColorImage = gltf.images[baseColorTexture.source]
      let url = path.join(basePath, baseColorImage.uri)
      console.log('loadingImage', url)
      loadImage(url, (err, img) => {
        if (err) return console.log(err)
        var tex = ctx.texture2D({
          data: img,
          width: img.width,
          height: img.height,
          encoding: ctx.Encoding.SRGB,
          pixelFormat: ctx.PixelFormat.RGBA8
          // flipY: true
        })
        console.log(tex)
        materialCmp.set({
          baseColorMap: tex
        })
      })
    }

    let components = [
      transformCmp,
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

      // TODO
      document.addEventListener('mousemove', function (e) {
        let weight1 = e.x / window.innerWidth
        let weight2 = e.y / window.innerHeight
        morphCmp.set({
          weights: [weight1, weight2]
        })
      })
    }

    node.entity = renderer.add(renderer.entity(components))

    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]
      const data = gltf.accessors[skin.inverseBindMatrices].data

      const inverseBindMatrices = []
      for (let i = 0; i < data.length; i += 16) {
        inverseBindMatrices.push(data.slice(i, i + 16))
      }

      const skinCmp = renderer.skin({
        inverseBindMatrices: inverseBindMatrices
      })
      node.entity.addComponent(skinCmp)
    }
  } else {
    node.entity = renderer.add(renderer.entity([
      transformCmp
    ]))
  }

  return node
}

function buildHierarchy (nodes, gltf) {
  nodes.forEach((node) => {
    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]

      const joints = skin.joints.map((i) => {
        return nodes[i].entity
      })

      node.entity.getComponent('Skin').set({
        joints: joints
      })
    }
  })

  nodes.forEach((node, index) => {
    let parentTransform = nodes[index].entity.transform
    if (node.children) {
      node.children.forEach((child) => {
        let childTransform = nodes[child].entity.transform
        childTransform.set({ parent: parentTransform })
      })
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

    const outputData = []
    const od = output.data
    const offset = AttributeSizeMap[output.type]
    for (let i = 0; i < output.data.length; i += offset) {
      if (offset === 3) {
        outputData.push([od[i], od[i + 1], od[i + 2]])
      }
      if (offset === 4) {
        outputData.push([od[i], od[i + 1], od[i + 2], od[i + 3]])
      }
    }

    const target = gltf.nodes[channel.target.node].entity

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
  })
})

function loadModel (file) {
  console.log('loadModel', file)

  State.animations = []

  // TODO: destroy materials and textures
  State.entities.forEach((e) => {
    renderer.remove(e)
  })
  State.entities = []

  loadJSON(file, (err, json) => {
    if (err) throw new Error(err)
    const basePath = path.dirname(file)

    json.buffers.forEach((buffer) => {
      buffer.uri = path.join(basePath, buffer.uri)
    })

    async.map(json.buffers, handleBuffer, function (err, res) {
      if (err) throw new Error(err)

      json.bufferViews.map((bufferView) => {
        handleBufferView(bufferView, json.buffers[bufferView.buffer].data)
      })

      json.accessors.map((accessor) => {
        handleAccessor(accessor, json.bufferViews[accessor.bufferView])
      })

      State.entities = json.nodes.map((node) => {
        return handleNode(node, json, basePath).entity
      })

      buildHierarchy(json.nodes, json)

      State.animations = State.animations.concat(json.animations.map((animation) => {
        return handleAnimation(animation, json)
      }))
    })
  })
}

const file = 'assets/gltf-sample-models/CesiumMan/gltf/CesiumMan.gltf'

loadModel(file)

var startTime = Date.now()

renderer.add(renderer.entity([
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

renderer.add(renderer.entity([
  renderer.transform({
    position: [-1, 1, -1]
  }),
  renderer.geometry(createCube(1)),
  renderer.material({
    baseColor: [0.9, 0.8, 0.05, 1],
    castShadows: true,
    receiveShadows: true
  })
]))

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
        } else if (path === 'scale') {
          target.transform.set({
            scale: currentOutput
          })
        }
      }
    })
  })
})
