const fs = require('fs')
const assert = require('assert')
const loadJSON = require('pex-io/loadJSON')
const loadBinary = require('pex-io/loadBinary')
const loadText = require('pex-io/loadText')
const loadImage = require('pex-io/loadImage')
const Mat4 = require('pex-math/Mat4')
const Vec3 = require('pex-math/Vec3')
const Quat = require('pex-math/Quat')
const createSphere = require('primitive-sphere')
const createCube = require('primitive-cube')
const createRenderer = require('../../../../')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createContext = require('pex-context')
const computeNormals = require('./local_modules/geom-compute-normals')
const toFlatGeometry = require('./local_modules/geom-to-flat-geometry')
const async = require('async')
const io = require('pex-io')
const parseThreeJSON = require('./parse-three.js')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 2,
  pauseOnBlur: true
})

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    direction: Vec3.sub(Vec3.create(), State.sunPosition),
    color: [1, 1, 0.95, 1],
    intensity: 10
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

  renderer.entity([ sun ])
  renderer.entity([ skybox ])
  renderer.entity([ reflectionProbe ])
}

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 5, 18],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  renderer.entity([
    renderer.camera({ camera: camera })
  ])
}

initSky()
initCamera()
let debugOnce = false

var WebGLConstants = {
  34963: 'ELEMENT_ARRAY_BUFFER',  // 0x8893
  34962: 'ARRAY_BUFFER',          // 0x8892
  5123: 'UNSIGNED_SHORT',         // 0x1403
  5125: 'UNSIGNED_INT',
  5126: 'FLOAT',                  // 0x1406
  4: 'TRIANGLES',                 // 0x0004
  35678: 'SAMPLER_2D',            // 0x8B5E
  35664: 'FLOAT_VEC2',            // 0x8B50
  35665: 'FLOAT_VEC3',            // 0x8B51
  35666: 'FLOAT_VEC4',            // 0x8B52
  35676: 'FLOAT_MAT4'             // 0x8B5C
}

const AttributeSizeMap = {
  'SCALAR': 1,
  'VEC4': 4,
  'VEC3': 3,
  'VEC2': 2,
  'MAT4': 16
}


let loaded = false
let animations = []

function handleBufferView (bufferView, bufferData) {
  bufferView.data = bufferData.slice(
    bufferView.byteOffset,
    bufferView.byteOffset + bufferView.byteLength
  )
}

function handleAccessor (accessor, bufferView) {
  const size = AttributeSizeMap[accessor.type]

  if (accessor.componentType === 5123) {
    data = new Uint16Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === 35664) {
    data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === 5126) {
    data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === 35665) {
    data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === 35666) {
    data = new Float32Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else if (accessor.componentType === 5125) {
    data = new Uint16Array(bufferView.data.slice(
      accessor.byteOffset,
      accessor.byteOffset + accessor.count * size * 4
    ))
    accessor.data = data
  } else {
    // TODO
    console.log('uncaught', accessor)
  }
}

function handleNode (node, gltf) {
  const transform = {
    position: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1]
  }
  if (node.matrix) transform.matrix = node.matrix

  const transformCmp = renderer.transform(transform)
  if (node.mesh !== undefined) {
    const mesh = gltf.meshes[node.mesh]

    const positionAccessor = gltf.accessors[mesh.primitives[0].attributes.POSITION]
    const normalAccessor = gltf.accessors[mesh.primitives[0].attributes.NORMAL]
    const indicesAccessor = gltf.accessors[mesh.primitives[0].indices]
    // TODO
    const tx = []
    positionAccessor.data.forEach(() => tx.push(0, 0))
    const geometryCmp = renderer.geometry({
      positions: positionAccessor.data,
      normals: normalAccessor.data,
      // texCoords: texcoordAccessor.data,
      texCoords: tx,
      indices: indicesAccessor.data,
    })

    const jointAccessor = gltf.accessors[mesh.primitives[0].attributes.JOINT]
    if (jointAccessor) geometryCmp.set({ joints: jointAccessor.data })
    const weightAccessor = gltf.accessors[mesh.primitives[0].attributes.WEIGHT]
    if (weightAccessor) geometryCmp.set({ weights: weightAccessor.data })

    const materialCmp = renderer.material({
      baseColor: [0.15, 0.15, 0.2, 1.0],
      roughness: 1,
      metallic: 0
    })

    node.entity = renderer.entity([
      transformCmp,
      geometryCmp,
      materialCmp
    ])

    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]
      const data = gltf.accessors[skin.inverseBindMatrices].data

      const inverseBindMatrices = []
      for (let i = 0; i < data.length; i += 16) {
        inverseBindMatrices.push(data.slice(i, i + 16))
      }

      const skinCmp = renderer.skin({
        bindShapeMatrix: skin.bindShapeMatrix,
        inverseBindMatrices: inverseBindMatrices
      })
      node.entity.addComponent(skinCmp)
    }

  } else {
    node.entity = renderer.entity([
      transformCmp
    ])
  }
}

function buildHierarchy (nodes, gltf) {
  nodes.forEach((node) => {
    if (node.skin !== undefined) {
      const skin = gltf.skins[node.skin]

      const joints = skin.jointNames.map((jointName) => {
        return nodes.find((n) => n.jointName == jointName).entity
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
    cb('gltf buffer.uri does not exist')
    return
  }
  loadBinary(buffer.uri, function (err, data) {
    console.log('data', data)
    buffer.data = data
    cb(err, data)
  })
}

function handleAnimation (animation, gltf) {
  return animation.channels.map((channel) => {
    const sampler = animation.samplers[channel.sampler]
    const input = gltf.accessors[sampler.input]
    const output = gltf.accessors[sampler.output]
    const inputData = input.data

    const outputData = []
    const od = output.data
    const offset = AttributeSizeMap[output.type]
    for (let i = 0; i < output.data.length; i+=offset) {
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

function partition (list, n) {
  const result = []
  for (var i = 0; i < list.length;) {
    var item = []
    for (var j = 0; j < n; j++) {
      item[j] = list[i++]
    }
    result.push(item)
  }
  return result
}

function bindToOtherMeshSkeleton (geometry, otherGeometry) {
  console.log('bindToOtherMeshSkeleton', geometry, otherGeometry)
  var joints = [];
  var weights = [];
  var numBones = 0;
  var bestVertexCache = [];

  for(var vi=0; vi < geometry.positions.length; vi++) {
    var currVertex = geometry.positions[vi];
    var currentVertexHash = -1;
    // if (this.geometry.instancePositions) {
      // currVertex = this.geometry.instancePositions[vi];
      // currentVertexHash = currVertex.toString();
    // }

    var bestVertex = null;
    if (currentVertexHash != -1) {
      bestVertex = bestVertexCache[currentVertexHash];
    }

    if (!bestVertex) {
      bestVertex = otherGeometry.positions.reduce(function(bestVertex, vertex, vertexIndex) {
        var dist = Vec3.distance(currVertex, vertex);
        if (dist < bestVertex.dist) {
          return {
            position: vertex,
            index: vertexIndex,
            dist: dist
          }
        }
        else {
          return bestVertex;
        }
      }, { index: -1, dist: Infinity });
      bestVertexCache[currentVertexHash] = bestVertex;
    }
    joints.push(otherGeometry.joints[bestVertex.index]);
    weights.push(otherGeometry.weights[bestVertex.index]);
  }

  return {
    joints: joints,
    weights: weights
  }
}
function initMeshes (geometry, color, body) {
  const components = []
  let bones = null
  let skin = null
  if (!body && geometry.bones) {
    console.log('json bones', geometry.bones)
    bones = geometry.bones.map((jsonBone) => {
      const bone = renderer.entity([
        renderer.transform({
          position: jsonBone.pos,
          rotation: jsonBone.rotq
        }),
        renderer.geometry(createCube(0.2)),
        renderer.material({
          baseColor: [0, 1, 0, 1]
        })
      ])
      bone.name = jsonBone.name // TODO: entity.name is nott officially supported
      return bone
    })
    bones.forEach((bone, index) => {
      const jsonBone = geometry.bones[index]
      if (jsonBone.parent !== -1) {
        bone.transform.set({
          parent: bones[jsonBone.parent].transform
        })
      }
    })
    skin = renderer.skin({
      joints: bones,
      inverseBindMatrices: bones.map((bone) => {
        bone.transform.update() //we need data now!
        return Mat4.invert(Mat4.copy(bone.transform.modelMatrix)) // TODO: this should be called transform
      }),
      bindShapeMatrix: Mat4.create()
    })
    components.push(skin)
  }

  if (geometry.animations && geometry.animations.length > 0) {
    console.log('json anim', geometry.animations)
    geometry.animations.forEach((animation) => {
      var channels = animation.tracks.map((track) => {
        const name = track[0]
        let values = track[2]
        const pathTokens = name.match(/\.(bones)\[(.+)\]\.(.+)/)
        ".bones[Hip].rotation"
        const animType = pathTokens[1]
        const boneName = pathTokens[2]
        const target = bones.find((bone) => { return bone.name === boneName })
        let path = pathTokens[3]
        if (path === 'position') {
          path = 'translation'
          values = partition(values, 3)
        }
        if (path === 'quaternion') {
          path = 'rotation'
          values = partition(values, 4)
        }
        if (path === 'scale') {
          path = 'scale'
          values = partition(values, 3)
        }
        const times = values.map((v, i, list) => animation.duration * i / (list.length - 1)) // FIXME: interpolate original times
        return {
          sampler: {
            input: times,
            output: values,
            interpolation: 'LINEAR'
          },
          target: {
            node: target,
            path: path
          }
        }
      })
      animations.push(channels)
      console.log('json anim', channels)
    })
  }
  var normals = computeNormals(geometry.vertices, geometry.faces)
  var uvs = geometry.vertices.map(() => [0, 0])

  components.push(renderer.transform({
  }))
  components.push(renderer.geometry({
    positions: geometry.vertices,
    uvs: uvs,
    normals: normals,
    indices: geometry.faces,
    joints: geometry.skinIndices,
    weights: geometry.skinWeights.map(
      (w) => {
        const sum = w[0] + w[1]
        return [w[0] / sum, w[1] / sum, 0, 0]
      }
    ),
    // primitive: ctx.Primitive.Lines
  }))
  components.push(
    renderer.material({
      baseColor: color || [0.9, 0.1, 0.1, 1],
      metallic: 0.9,
      roughness: 0.1
    })
  )
  var mesh = renderer.entity(components)
  if (body) {
    var geometry = mesh.getComponent('Geometry')
    var otherGeometry = body.getComponent('Geometry')
    var binding = bindToOtherMeshSkeleton(geometry, otherGeometry)
    console.log('json binding', binding)
    geometry.set({
      joints: binding.joints,
      weights: binding.weights
    })
    var bodySkin = body.getComponent('Skin')
    mesh.addComponent(renderer.skin({
      joints: bodySkin.joints,
      bindShapeMatrix: bodySkin.bindShapeMatrix,
      inverseBindMatrices: bodySkin.inverseBindMatrices
    }))
  }
  return mesh
}


io.loadJSON('female_walking_lowpoly.js', (err, json) => {
// io.loadJSON('assets/models/female_export_texturemap.js', (err, json) => {
// io.loadJSON('assets/models/male_walking_lowpoly.js', (err, json) => {
// io.loadJSON('/assets/female/femaleDress.js', (err, json) => {
  console.log('json', err, json)
  var body = initMeshes(parseThreeJSON(json), [1, 1, 1, 1])
  console.log('json body', body)
  io.loadJSON('femaleDress1.js', (err, json) => { // OK
   // io.loadJSON('/assets/female/femaleDress2.js', (err, json) => { // OK
  // io.loadJSON('/assets/female/femaleTop.js', (err, json) => { // ALMOST
  // io.loadJSON('/assets/female/femaleSleeveless.js', (err, json) => { // OK
  // io.loadJSON('/assets/female/femaleSkirt.js', (err, json) => { // OK
  // io.loadJSON('/assets/female/femaleSkirtLong.js', (err, json) => { // OK
  // io.loadJSON('/assets/female/femalePants2.js', (err, json) => { // OK
  // io.loadJSON('/assets/female/juliayrenataShirt.js', (err, json) => { // OK
    console.log('json', err, json)
    initMeshes(parseThreeJSON(json), [1, 1, 0, 1], body)
  })
})


// loadJSON('Monster.gltf', function (err, json) { // works
// loadJSON('CesiumMan.gltf', function (err, json) { // works
// loadJSON('BrainStem.gltf', function (err, json) { // does NOT work
// loadJSON('BrainStem.gltf', function (err, json) {
loadJSON('male.gltf', function (err, json) {
  loaded = true
  return
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

        let prevIndex = undefined
        let nextIndex = undefined
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
          }
          else if (path === 'rotation') {
            target.transform.set({
              rotation: currentOutput
            })
          }
          else if (path === 'scale') {
            target.transform.set({
              scale: currentOutput
            })
          }
        }
      })
    })
  }
})

