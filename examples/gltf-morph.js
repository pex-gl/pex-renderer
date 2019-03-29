const path = require('path')
const loadJSON = require('pex-io/loadJSON')
const createCube = require('primitive-cube')
const loadBinary = require('pex-io/loadBinary')
const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const createRenderer = require('../')
const createContext = require('pex-context')
const async = require('async')
const isBrowser = require('is-browser')
const log = require('debug')('gltf-build')
const assert = require('assert')

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const AttributeNameMap = {
  POSITION: 'positions',
  NORMAL: 'normals',
  TANGENT: 'tangents',
  TEXCOORD_0: 'texCoords',
  TEXCOORD_1: 'texCoords1',
  JOINTS_0: 'joints',
  WEIGHTS_0: 'weights',
  COLOR_0: 'vertexColors'
}


const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 4,
  pauseOnBlur: true
})

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

function initSky (panorama) {
  const sun = renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 10
  })

  const skybox = renderer.skybox({
    sunPosition: State.sunPosition
  })

  const reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })

  renderer.add(renderer.entity([
    renderer.transform({
      position: State.sunPosition,
      rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize(vec3.sub([0, 0, 0], State.sunPosition)))
    }),
    sun
  ]))
  renderer.add(renderer.entity([ skybox ]))
  renderer.add(renderer.entity([ reflectionProbe ]))
}

function initCamera () {
  renderer.add(renderer.entity([
    renderer.camera({
      fov: Math.PI / 3,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      near: 0.1,
      far: 100
    }),
    renderer.orbiter({
      position: [3, 3, 3]
    })
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

let loaded = false
let animations = []

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

log.enabled = true

function handleMesh (mesh, gltf) {
  return mesh.primitives.map((primitive) => {
    const attributes = Object.keys(primitive.attributes).reduce((attributes, name) => {

      const accessor = gltf.accessors[primitive.attributes[name]]

      // TODO: add stride support (requires update to pex-render/geometry
      if (accessor._buffer) {
        const attributeName = AttributeNameMap[name]

        assert(attributeName, `GLTF: Unknown attribute '${name}'`)
        attributes[attributeName] = {
          buffer: accessor._buffer,
          offset: accessor.byteOffset,
          type: accessor.componentType,
          stride: accessor._bufferView.stride
        }
      } else {
        const attributeName = AttributeNameMap[name]
        assert(attributeName, `GLTF: Unknown attribute '${name}'`)
        attributes[attributeName] = accessor.data
      }
      return attributes
    }, {})

    log('handleMesh.attributes', attributes)

    const positionAccessor = gltf.accessors[primitive.attributes.POSITION]
    const indicesAccessor = gltf.accessors[primitive.indices]
    log('handleMesh.positionAccessor', positionAccessor)
    log('handleMesh.indicesAccessor', indicesAccessor)

    const geometryCmp = renderer.geometry(attributes)
    geometryCmp.set({
      bounds: [positionAccessor.min, positionAccessor.max]
    })

    if (indicesAccessor) {
      if (indicesAccessor._buffer) {
        log('indicesAccessor._buffer', indicesAccessor)
        geometryCmp.set({
          indices: {
            buffer: indicesAccessor._buffer,
            offset: indicesAccessor.byteOffset,
            type: indicesAccessor.componentType,
            count: indicesAccessor.count
          }
        })
      } else {
        // TODO: does it ever happen?
        geometryCmp.set({
          indices: indicesAccessor.data
        })
      }
    } else {
      geometryCmp.set({
        count: positionAccessor.buffer.length / 3
      })
    }

    let materialCmp = null
    // if (primitive.material !== undefined) {
    //   const material = gltf.materials[primitive.material]
    //   materialCmp = handleMaterial(material, gltf, ctx, renderer)
    // } else {
    //   materialCmp = renderer.material({})
    // }
      materialCmp = renderer.material({
        roughness: 0.1,
        metallic: 0,
        baseColor: [1, 0.2, 0.2, 1],
        castShadows: true,
        receiveShadows: true
      })

    let components = [
      geometryCmp,
      materialCmp
    ]
    log('components', components)

    if (primitive.targets) {
      let sources = {}
      const targets = primitive.targets.reduce((targets, target) => {
        const targetKeys = Object.keys(target)

        targetKeys.forEach(targetKey => {
          const targetName = AttributeNameMap[targetKey] || `${targetKey.toLowerCase()}`
          targets[targetName] = targets[targetName] || []
          targets[targetName].push(gltf.accessors[target[targetKey]].data)

          if (!sources[targetName]) {
            sources[targetName] = gltf.accessors[primitive.attributes[targetKey]].data
          }
        })
        return targets
      }, {})

      const morphCmp = renderer.morph({
        sources,
        targets,
        weights: mesh.weights
      })
      components.push(morphCmp)
    }

    return components
  })
}

function handleNode (node, gltf, i) {
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
    const data = gltf.accessors[skin.inverseBindMatrices]._data

    let inverseBindMatrices = []
    for (let i = 0; i < data.length; i += 16) {
      inverseBindMatrices.push(data.slice(i, i + 16))
    }

    skinCmp = renderer.skin({
      inverseBindMatrices: inverseBindMatrices
    })
  }

  if (node.mesh !== undefined) {
    const primitives = handleMesh(gltf.meshes[node.mesh], gltf, ctx, renderer)
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
  nodes.forEach((node) => {
    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]

      const joints = skin.jointNames.map((jointName) => {
        return nodes.find((n) => n.jointName === jointName).entity
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
  loadBinary(`${ASSETS_DIR}/${buffer.uri}`, function (err, data) {
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
    console.log('animation channel', channel, output.type, input, output, sampler, animation, channel)
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

loadJSON(`${ASSETS_DIR}/AnimatedMorphCube.gltf`, function (err, json) {
  if (err) throw new Error(err)

  async.map(json.buffers, handleBuffer, function (err, res) {
    if (err) throw new Error(err)

    json.bufferViews.map((bufferView) => {
      handleBufferView(bufferView, json.buffers[bufferView.buffer].data)
    })

    json.accessors.map((accessor) => {
      handleAccessor(accessor, json.bufferViews[accessor.bufferView])
    })

    json.nodes.map((node) => {
      handleNode(node, json)
    })

    buildHierarchy(json.nodes, json)

    animations = animations.concat(json.animations.map((animation) => {
      return handleAnimation(animation, json)
    }))

    loaded = true
  })
})

var startTime = Date.now()

renderer.entity([
  renderer.transform({
    position: [0, -0.05, 0]
  }),
  renderer.geometry(createCube(5, 0.1, 5)),
  renderer.material({
    baseColor: [0.8, 0.5, 0.5, 1]
  })
])

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  if (loaded) {
    var elapsedTime = Date.now() - startTime
    var ms = (elapsedTime / 1000).toFixed(3)

    animations.forEach((channels, i) => {
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
          } else if (path === 'weights') {
            target.getComponent('Morph').set({
              // weights: [nextOutput[0], 1] // FIXME: hardcoded
              weights: nextOutput
            })
          }
        }
      })
    })
  }
})
