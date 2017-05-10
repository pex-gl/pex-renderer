const fs = require('fs')
const loadJSON = require('pex-io/loadJSON')
const loadBinary = require('pex-io/loadBinary')
const loadText = require('pex-io/loadText')
const loadImage = require('pex-io/loadImage')
const Mat4 = require('pex-math/Mat4')
const Vec3 = require('pex-math/Vec3')
const createSphere = require('primitive-sphere')
const createCube = require('primitive-cube')
const createRenderer = require('../../../../')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createContext = require('pex-context')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 2
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
    position: [0, 3, 8],
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
  5126: 'FLOAT',                  // 0x1406
  4: 'TRIANGLES',                 // 0x0004
  35678: 'SAMPLER_2D',            // 0x8B5E
  35664: 'FLOAT_VEC2',            // 0x8B50
  35665: 'FLOAT_VEC3',            // 0x8B51
  35666: 'FLOAT_VEC4',            // 0x8B52
  35676: 'FLOAT_MAT4'             // 0x8B5C
}

var Quat = require('pex-math/Quat')

// loadJSON('Cube.gltf', function (err, json) {
loadJSON('male.gltf', function (err, json) {
  if (err) console.log('loadJSON', err)
  /*
  var c = createCube(1, 1, 2)
  c.positions.forEach((p) => p[2] += 1)
  var cube = renderer.entity([
    renderer.transform({
      position: [0, 0, 0],
      rotation: Quat.fromDirection(Quat.create(), [0.1, 1, 0])
    }),
    renderer.geometry(c),
    renderer.material({
      baseColor: [1, 0, 0, 1]
    })
  ])
  var child = renderer.entity([
    renderer.geometry(c),
    renderer.transform({
      position: [0, 0, 2],
      rotation: Quat.fromDirection(Quat.create(), [1, 0, 0])
    }),
    renderer.material({
      baseColor2: [0, 0, 1, 1]
    })
  ], cube)

  var child2 = renderer.entity([
    renderer.geometry(c),
    renderer.transform({
      position: [0, 0, 2],
      rotation: Quat.fromDirection(Quat.create(), [0, 1, 0])
    }),
    renderer.material({
      baseColor: [0, 1, 1, 1]
    })
  ], child)
  */

  var firstBuffer = json.buffers[0]
  if (firstBuffer.uri) {
    loadBinary(firstBuffer.uri, function (err, data) {
      firstBuffer.data = data
      console.log('first buffer data', data)

      var accessors = json.accessors
      var nodes = json.nodes
      var bufferViews = json.bufferViews

      var firstMesh = json.meshes[0]
      var primitives = firstMesh.primitives[0]
      var attributes = primitives.attributes
      var normalAccessor = accessors[attributes.NORMAL]
      console.log(normalAccessor)
      var positionAccessor = accessors[attributes.POSITION]
      console.log(positionAccessor)
      // var tangentAccessor = accessors[attributes.TANGENT]
      // console.log(tangentAccessor)
      // var texcoordAccessor = accessors[attributes.TEXCOORD_0]
      // console.log(texcoordAccessor)
      var indicesAccessor = accessors[primitives.indices]

      handleAccessor(normalAccessor)
      console.log('normals', normalAccessor.data)

      handleAccessor(positionAccessor)
      console.log('positions', positionAccessor.data)

      // handleAccessor(tangentAccessor)
      // console.log('tangents', tangentAccessor.data)

      // handleAccessor(texcoordAccessor)
      // console.log('texcoords', texcoordAccessor.data)

      handleAccessor(indicesAccessor)
      console.log('indices', indicesAccessor.data)

      // var material = materials[primitives.material]
      //
      nodes.forEach((node) => {
        var transform = {
          position: node.translation || [0, 0, 0],
          rotation: node.rotation || [0, 0, 0, 1],
          scale: node.scale || [1, 1, 1]
        }
        if (node.matrix) transform.matrix = node.matrix
        // console.log('rotation', node, node.rotation)

        // console.log('node mesh', node.mesh)

        var transformCmp = renderer.transform(transform)
        if (node.mesh === 0) {

          console.log('vert leng', positionAccessor.data.length)
          var tx = []
          positionAccessor.data.forEach(() => tx.push(0, 0))

          var geometryCmp = renderer.geometry({
            positions: positionAccessor.data,
            normals: normalAccessor.data,
            // texCoords: texcoordAccessor.data,
            texCoords: tx,
            indices: indicesAccessor.data,
            primitive: 'lines'
          })

          var materialCmp = renderer.material({
            baseColor: [0.15, 0.15, 0.2, 1.0],
            roughness: 1,
            metallic: 0
          })

          node.entity = renderer.entity([
            transformCmp,
            geometryCmp,
            materialCmp
          ])
        } else if (node.jointName) {
          console.log(node.jointName)
          // const sphere = createSphere(0.01)
          const sphere = createCube(0.01, 0.1, 0.01)
          node.entity = renderer.entity([
            transformCmp,
            renderer.geometry(sphere),
            renderer.material({
              baseColor: [0.8, 0.8, 0.8, 1.0],
              roughness: 1,
              metallic: 0
            })
          ])
        } else {
          node.entity = renderer.entity([
            transformCmp
          ])
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
        // parseNode(node, null)
      })

      function handleAccessor (accessor) {
        const AttributeSizeMap = {
          'SCALAR': 1,
          'VEC4': 4,
          'VEC3': 3,
          'VEC2': 2,
          'MAT4': 16
        }

        var size = AttributeSizeMap[accessor.type]


        // gltf buffer = binary file
        // gltf buffer view = slice of binary file = ctx buffer
        // gltf accessor = attribute
        //
        // geometry should accept
        // positions = Array of [x, y, z]
        // positions = TypedArray
        // positions = ctx.vertexBuffer
        // positions = { buffer: ctx.vertexBuffer, offset: 0, stride: 0 }

        // if (accessor.componentType === 5126) {
          // float
          var bufferView = bufferViews[accessor.bufferView]

          if (bufferView.target === 34963) {
            // element array buffer
            data = new Uint16Array(firstBuffer.data.slice(
              bufferView.byteOffset,
              bufferView.byteOffset + accessor.count * size * 2
            ))

            accessor.data = data
          }
          if (bufferView.target === 34962) {
            // array buffer
            data = new Float32Array(firstBuffer.data.slice(
                bufferView.byteOffset,
                bufferView.byteOffset + bufferView.byteLength
              ).slice(
                accessor.byteOffset,
                accessor.byteOffset + accessor.count * size * 4
              )
            )

            accessor.data = data
          }
        // }
      }

    })
  } else {
    throw new Error('gltf/handleBuffer missing uri in ')
  }

})

ctx.frame(() => {
    ctx.debug(debugOnce)
    debugOnce = false
    renderer.draw()
})

