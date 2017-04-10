const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const Renderer = require('../../Renderer')
const createCube = require('primitive-cube')
const createSphere = require('primitive-sphere')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const Color = require('pex-color')
const remap = require('pex-math/Utils').map
const cosineGradient = require('cosine-gradient')
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const scheme = [[0.650, 0.500, 0.310], [-0.650, 0.500, 0.600], [0.333, 0.278, 0.278], [0.660, 0.000, 0.667]]
const scheme2 = [[0.500, 0.500, 0.000], [0.500, 0.500, 0.000], [0.100, 0.500, 0.000], [0.000, 0.000, 0.000]]
const gradient = cosineGradient(scheme)
const gradient2 = cosineGradient(scheme2)

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

random.seed(10)

const renderer = new Renderer(ctx, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight)

const gui = createGUI(ctx)
gui.addHeader('Settings')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)
gui.addTexture2D('Skybox', renderer._skyEnvMapTex.texture)

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(renderer._state.sunPosition, 1, 0, 0)
  Vec3.multMat4(renderer._state.sunPosition, State.elevationMat)
  Vec3.multMat4(renderer._state.sunPosition, State.rotationMat)
}

function initCamera () {
  const camera = createCamera({
    fov: 45,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 3, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
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
  const cube = buildMesh(createCube(0.1))
  const offsets = []
  const colors = []

  const center = [0.75, 0.75, 0.75]
  const radius = 1.25

  const center2 = [-0.75, -0.75, 0.75]
  const radius2 = 1.25

  const n = 15
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        const pos = [
          remap(x, 0, n, -1, 1),
          remap(y, 0, n, -1, 1),
          remap(z, 0, n, -1, 1)
        ]
        const dist = Vec3.distance(pos, center)
        if (dist < radius) {
          const force = Vec3.sub(Vec3.copy(pos), center)
          Vec3.normalize(force)
          Vec3.scale(force, 1 - Math.sqrt(dist / radius))
          Vec3.add(pos, force)
        }
        const dist2 = Vec3.distance(pos, center2)
        if (dist2 < radius2) {
          const force = Vec3.sub(Vec3.copy(pos), center2)
          Vec3.normalize(force)
          Vec3.scale(force, 1 - Math.sqrt(dist2 / radius2))
          Vec3.add(pos, force)
        }
        offsets.push(pos)
        const value = Math.min(1, dist / radius)
        const value2 = Math.min(1, dist2 / radius2)
        // const color = Color.fromHSL((1 - Vec3.length(pos) / 100) + 0.4, 0.8, 0.5)
        const colorBase = [0.8, 0.1, 0.1, 1.0]
        const color = gradient(value)
        const color2 = gradient2(value2)
        Vec3.lerp(colorBase, [0, 0, 0, 0], Math.max(0, 1 - value - value2))
        // Vec3.scale(colorBase, 0)
        Vec3.lerp(color, [0, 0, 0, 0], value)
        Vec3.lerp(color2, [0, 0, 0, 0], value2)
        Vec3.add(colorBase, color)
        Vec3.add(colorBase, color2)
        colors.push(colorBase)
      }}}
  cube.attributes.aOffset = {
    buffer: ctx.vertexBuffer(offsets),
    divisor: 1
  }
  cube.attributes.aColor = {
    buffer: ctx.vertexBuffer(colors),
    divisor: 1
  }
  const node = renderer.createNode({
    mesh: cube,
    position: [0, 0, 0],
    material: {
      // baseColor: [0.8, 0.1, 0.1, 1],
      baseColor: [1, 1, 1, 1],
      rougness: 0.5, // (k + 5) / 10,
      metallic: 0.01 // (j + 5) / 10
    }
  })
  renderer.add(node)
  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    node.data.material.roughness = State.roughness
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    node.data.material.metallic = State.metallic
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    node.data.material.baseColor = State.baseColor
  })
}

function initLights () {
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
  ctx.debug(frameNumber++ < 2 || debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
