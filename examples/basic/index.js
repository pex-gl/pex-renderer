const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createRenderer = require('../../')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
dragon.positions = centerAndNormalize(dragon.positions).map((v) => Vec3.scale(v, 5))
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

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
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

random.seed(10)

const renderer = createRenderer({ ctx: ctx })

const gui = createGUI(ctx)
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)

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

// gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

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

function initMeshes () {
  const groundCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.01)
  const roundedCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.2)
  const capsule = createCapsule(0.3)
  const sphere = createSphere(0.5)
  const geometries = [capsule, roundedCube, sphere]
  const entities = []

  renderer.entity([
    renderer.transform({
      position: [0, -2.2, 0],
      scale: [20, 0.2, 7]
    }),
    renderer.geometry(groundCube),
    renderer.material({
      baseColor: [0.15, 0.15, 0.2, 1.0],
      roughness: 1,
      metallic: 0
    })
  ])

  const dragonEnt = renderer.entity([
    renderer.transform({
      position: [0, -0.4, 2],
    }),
    renderer.geometry(dragon),
    renderer.material({
      baseColor: [0.8, 0.8, 0.8, 1.0],
      roughness: 1,
      metallic: 0
    })
  ])
  entities.push(dragonEnt)

  let materialIndex = 0
  for (let j = -5; j <= 5; j += 2) {
    for (let i = 0; i < geometries.length; i++) {
      const geom = geometries[i]
      const x = j
      const y = 1.5 * (1 - i)
      const z = 0
      const entity = renderer.entity([
        renderer.transform({
          position: [x, y, z]
        }),
        renderer.geometry(geom),
        renderer.material({
          baseColor: [0.9, 0.9, 0.9, 1],
          baseColorMap: materialIndex ? State.materials[materialIndex].baseColorTex : null,
          roughness: (j + 5) / 10,
          roughnessMap: materialIndex ? State.materials[materialIndex].roughnessTex : null,
          metallic: 0.0, // 0.01, // (j + 5) / 10
          metallicMap: materialIndex ? State.materials[materialIndex].metallicTex : null,
          normalMap: materialIndex ? State.materials[materialIndex].normalTex : null
        })
      ])
      entities.push(entity)
    }
    materialIndex = (materialIndex + 1) % State.materials.length
  }
  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ roughness: State.roughness }) })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ metallic :State.metallic }) })
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ baseColor: State.baseColor }) })
  })
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

function initLights () {
  const pointLight1 = renderer.entity([
    renderer.geometry(createSphere(0.2)),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    }),
    renderer.transform({
      position: [2, 2, 2]
    }),
    renderer.pointLight({
      color: [1, 0, 0, 1],
      intensity: 3,
      radius: 10
    })
  ])

  const pointLight2 = renderer.entity([
    renderer.geometry(createSphere(0.2)),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [0, 0.5, 1, 1]
    }),
    renderer.transform({
      position: [-2, 2, 2]
    }),
    renderer.pointLight({
      color: [0, 0.5, 1, 1],
      intensity: 3,
      radius: 10
    })
  ])

  gui.addParam('Light 1 Pos', pointLight1.transform, 'position', { min: -5, max: 5 }, (value) => {
    pointLight1.transform.set({ position: value })
  })

  /*
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
  */
}


initCamera()
initMeshes()
initSky()
initLights()

let frameNumber = 0
let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

updateSunPosition()

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
