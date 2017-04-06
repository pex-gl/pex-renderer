const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const Renderer = require('../../Renderer')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0]
}

random.seed(10)

const renderer = new Renderer(ctx, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight)

const gui = createGUI(ctx)
gui.addHeader('Settings')
gui.addParam('New PBR', renderer._state, 'useNewPBR')
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(renderer._state.sunPosition, 1, 0, 0)
  Vec3.multMat4(renderer._state.sunPosition, State.elevationMat)
  Vec3.multMat4(renderer._state.sunPosition, State.rotationMat)
}

// gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

function initCamera () {
  const camera = createCamera({
    fov: 45,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 3, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 50
  })

  var cameraNode = renderer.createNode({
    camera: camera
  })
  renderer.add(cameraNode)

  createOrbiter({ camera: camera })
}

function buildMesh (geometry, primitiveType) {
  if (primitiveType) throw new Error('primitiveType not supported yet')
  return {
    attributes: {
      aPosition: ctx.vertexBuffer(geometry.positions),
      aTexCoord0: ctx.vertexBuffer(geometry.uvs),
      aNormal: ctx.vertexBuffer(geometry.normals)
    },
    indices: ctx.indexBuffer(geometry.cells)
  }
}

function initMeshes () {
  const roundedCubeMesh = buildMesh(createRoundedCube(1, 1, 1, 20, 20, 20, 0.2))
  const capsuleMesh = buildMesh(createCapsule(0.3))
  const sphereMesh = buildMesh(createSphere(0.5))
  const meshes = [capsuleMesh, roundedCubeMesh, sphereMesh]
  const nodes = []
  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i]
    for (var j = -5; j <= 5; j += 2) {
      const x = j
      const y = 1.5 * (1 - i)
      const z = 0
      const node = renderer.createNode({
        mesh: mesh,
        position: [x, y, z],
        material: {
          baseColor: [0.8, 0.1, 0.1, 1],
          rougness: 0.5, // (k + 5) / 10,
          metallic: 0.01// (j + 5) / 10
        }
      })
      nodes.push(node)
      renderer.add(node)
    }
  }
  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    nodes.forEach((node) => node.data.material.roughness = State.roughness)
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    nodes.forEach((node) => node.data.material.metallic = State.metallic)
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    nodes.forEach((node) => node.data.material.baseColor = State.baseColor)
  })
}

function initLights () {
  var sunDir = Vec3.normalize([1, -1, 1])
  var sunLightNode = renderer.createNode({
    light: {
      type: 'directional',
      color: [1, 1, 0, 1],
      direction: sunDir
    }
  })
  // renderer.add(sunLightNode)

  gui.addTexture2D('Shadow Map', renderer._sunLightNode.data.light._shadowMap)
  const sphereMesh = buildMesh(createSphere(0.2))
  var pointLight = renderer.createNode({
    mesh: sphereMesh,
    position: [2, 2, 2],
    material: {
      baseColor: [1, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    },
    light: {
      type: 'point',
      position: [2, 2, 2],
      color: [1, 0, 0, 1],
      radius: 50
    }
  })
  // renderer.add(pointLight)

  var areaLightMesh = buildMesh(createCube(1))
  var areaLightColor = [0, 1, 0, 1]
  var areaLightNode = renderer.createNode({
    enabled: true,
    position: [5, 2, 0],
    scale: [2, 5, 0.1],
    rotation: Quat.fromDirection(Quat.create(), [-1, 0, 0]),
    mesh: areaLightMesh,
    material: {
      emissiveColor: areaLightColor,
      baseColor: [0, 0, 0, 1],
      metallic: 1.0,
      roughness: 0.74
    },
    light: {
      type: 'area',
      intensity: 2,
      color: areaLightColor
    }
  })
  gui.addParam('AreaLight Size', areaLightNode.data, 'scale', { min: 0, max: 5 }, (value) => {
    areaLightNode.setScale(value[0], value[1], value[2])
  })
  gui.addParam('AreaLight Intensity', areaLightNode.data.light, 'intensity', { min: 0, max: 5 })
  gui.addParam('AreaLight', areaLightNode.data.light, 'color', { type: 'color' })
  renderer.add(areaLightNode)
}

initCamera()
initMeshes()
// initLights()

let frameNumber = 0
let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

updateSunPosition()

ctx.frame(() => {
  // ctx.debug(frameNumber++ == 1)
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
