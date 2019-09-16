const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const io = require('pex-io')
const { quat, vec3 } = require('pex-math')
const GUI = require('pex-gui')
const isBrowser = require('is-browser')
const { loadText } = require('pex-io')
const createCube = require('primitive-cube')
const dragon = require('./assets/models/stanford-dragon/stanford-dragon')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')

const bBoxHelper = require('../helpers/bounding-box-helper')
const lightHelper = require('../helpers/light-helper')
const cameraHelper = require('../helpers/camera-helper')
const axisHelper = require('../helpers/axis-helper')
const gridHelper = require('../helpers/grid-helper')

const State = {
  rotation: 1.5 * Math.PI
}
const ctx = createContext()
const renderer = createRenderer(ctx)
const gui = new GUI(ctx)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const orbitCameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
    viewport: [0, 0, Math.floor(0.75 * window.innerWidth), window.innerHeight]
  }),
  renderer.transform({ position: [0, 2, 3] }),
  renderer.orbiter({ position: [2, 2, -2] })
])
renderer.add(orbitCameraEntity)

const persCameraCmp = renderer.camera({
  fov: Math.PI / 4,
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  near: 1,
  far: 8,
  postprocess: false,
  viewport: [
    Math.floor(0.75 * window.innerWidth),
    window.innerHeight - Math.floor((1 / 2) * window.innerHeight),
    Math.floor(0.25 * window.innerWidth),
    Math.floor((1 / 2) * window.innerHeight)
  ]
})
const persCameraEntity = renderer.entity([
  persCameraCmp,
  renderer.transform({
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 5, 0, 0])
  }),
  cameraHelper({ color: [1, 0.7, 0, 1] })
])
renderer.add(persCameraEntity)



const orthoCameraCmp = renderer.camera({
  fov: Math.PI / 3,
  projection: 'orthographic',
  aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
  near: 0.1,
  far: 10,
  zoom: 3,
  postprocess: false,
  viewport: [
    Math.floor(0.75 * window.innerWidth),
    0,
    Math.floor(0.25 * window.innerWidth),
    Math.floor((1 / 2) * window.innerHeight)
  ]
})
const orthoCameraEntity = renderer.entity([
  orthoCameraCmp,
  renderer.transform({
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI / 5, 0, 0])
  }),
  cameraHelper()
])
renderer.add(orthoCameraEntity)

// skybox and  reflection probe
const skybox = renderer.entity([
  renderer.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation)
  }),
  renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true
  })
])
renderer.add(skybox)
const reflectionProbe = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbe)

//lights
const directionalLightCmp = renderer.directionalLight({
  castShadows: true,
  color: [1, 1, 1, 1],
  intensity: 5
})
const directionalLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [-1, 2, -1]
  }),
  directionalLightCmp,
  lightHelper()
])
renderer.add(directionalLight)
gui.addColumn('Lights')
gui.addHeader('Directional Light')
gui.addParam('Enabled', directionalLightCmp, 'enabled', {}, (value) => {
  directionalLightCmp.set({ enabled: value })
})
gui.addParam(
  'Intensity',
  directionalLightCmp,
  'intensity',
  { min: 0, max: 20 },
  () => {
    directionalLightCmp.set({ intensity: directionalLightCmp.intensity })
  }
)

const pointLightCmp = renderer.pointLight({
  castShadows: true,
  color: [0, 1, 0, 1],
  intensity: 6
})
const pointLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [1, 0.1, 1.5]
  }),
  pointLightCmp,
  lightHelper()
])
renderer.add(pointLight)

gui.addHeader('Point Light')
gui.addParam('Enabled', pointLightCmp, 'enabled', {}, (value) => {
  pointLightCmp.set({ enabled: value })
})
gui.addParam('Range', pointLightCmp, 'range', {
  min: 0,
  max: 20
})
gui.addParam(
  'Intensity',
  pointLightCmp,
  'intensity',
  { min: 0, max: 20 },
  () => {
    pointLightCmp.set({ intensity: pointLightCmp.intensity })
  }
)
gui.addParam('Shadows', pointLightCmp, 'castShadows', {}, (value) => {
  pointLightCmp.set({ castShadows: value })
})


const areaLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [-1, 1, 1]
  }),
  renderer.areaLight({
    castShadows: true,
    color: [0, 1, 1, 1],
    intensity: 15
  }),
  lightHelper()
])
renderer.add(areaLight)
const areaLightCmp = areaLight.getComponent('AreaLight')
// GUI
gui.addHeader('Area Light')
gui.addParam('Enabled', areaLightCmp, 'enabled', {}, (value) => {
  areaLightCmp.set({ enabled: value })
})
gui.addParam(
  'AreaLight Size',
  areaLight.transform,
  'scale',
  { min: 0, max: 5 },
  (value) => {
    areaLight.transform.set({ scale: [value[0], value[1], value[2]] })
  }
)
gui.addParam(
  'AreaLight Intensity',
  areaLight.getComponent('AreaLight'),
  'intensity',
  { min: 0, max: 70 }
)
gui.addParam('AreaLight', areaLight.getComponent('AreaLight'), 'color', {
  type: 'color'
})

const spotLightCmp = renderer.spotLight({
  castShadows: true,
  color: [1, 1, 1, 1],
  intensity: 50,
  range: 3
})
const spotLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [2, 1, 0]
  }),
  spotLightCmp,
  lightHelper()
])
renderer.add(spotLight)

gui.addHeader('Spot Light')
gui.addParam('Enabled', spotLightCmp, 'enabled', {}, (value) => {
  spotLightCmp.set({ enabled: value })
})
gui.addParam('Range', spotLightCmp, 'range', {
  min: 0,
  max: 20
})
gui.addParam(
  'Intensity',
  spotLightCmp,
  'intensity',
  { min: 0, max: 70 },
  () => {
    spotLightCmp.set({ intensity: spotLightCmp.intensity })
  }
)
gui.addParam('Angle', spotLightCmp, 'angle', {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON
})
gui.addParam('Inner angle', spotLightCmp, 'innerAngle', {
  min: 0,
  max: Math.PI / 2 - Number.EPSILON
})

//floor
const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.4, 0]
  }),
  renderer.geometry(createCube(7, 0.1, 5)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false
  }),
  bBoxHelper()
])
renderer.add(floorEntity)

//static mesh
dragon.positions = centerAndNormalize(dragon.positions)
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])
const dragonEntity = renderer.entity([
  renderer.geometry(dragon),
  renderer.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true
  }),
  renderer.transform({
    position: [-1.5, 0, 0]
  }),
  bBoxHelper({ color: [1, 1, 0, 1] })
])
renderer.add(dragonEntity)

//animated mesh
// loadScene(`${ASSETS_DIR}/models/AnimatedMorphCube/AnimatedMorphCube.gltf`, {
//   scale: [30, 30, 30],
//   position: [-0.3, 0, 0]
// })

//animated skinned mesh
loadScene(`${ASSETS_DIR}/models/CesiumMan/CesiumMan.gltf`, {
  scale: [0.8, 0.8, 0.8],
  position: [0.5, -0.35, 0]
})

//buster drone
loadScene(`${ASSETS_DIR}/models/buster-drone/scene.gltf`, {
  scale: [0.006, 0.006, 0.006],
  position: [-0.3, 0.25, 0]
})

//instanced mesh
const gridSize = 3
let grid = []
for (let i = 0; i < gridSize; i++) {
  for (let j = 0; j < gridSize; j++) {
    for (let k = 0; k < gridSize; k++) {
      grid.push([i / 4, j / 4, k / 4])
    }
  }
}

let cubeG = createCube(0.1, 0.1, 0.1)
console.log(grid)
const instGeometry = renderer.geometry({
  positions: cubeG.positions,
  normals: cubeG.normals,
  uvs: cubeG.uvs,
  cells: cubeG.cells,
  offsets: { data: grid, divisor: 1 },
  instances: grid.length
})
let instEntity = renderer.entity([
  instGeometry,
  renderer.material({
    baseColor: [0.5, 1, 0.7, 1],
    castShadows: true,
    receiveShadows: true
  }),
  renderer.transform({ position: [1.7, -0.2, 0] }),
  bBoxHelper()
])
renderer.add(instEntity)



gui.addColumn('Cameras')
gui.addHeader('Perspective Cam')
gui.addParam(
  'fieldOfView (rad)',
  persCameraCmp,
  'fov',
  { min: 0, max: (120 / 180) * Math.PI },
  (fov) => {
    persCameraCmp.set({ fov })
  }
)
gui.addParam(
  'Near',
  persCameraCmp,
  'near',
  { min: 0, max: 5 },
  (near) => {
    persCameraCmp.set({ near })
  }
)
gui.addParam(
  'Far',
  persCameraCmp,
  'far',
  { min: 5, max: 50 },
  (far) => {
    persCameraCmp.set({ far })
  }
)

gui.addHeader('Orthographic Cam')
gui.addParam(
  'Near',
  orthoCameraCmp,
  'near',
  { min: 0, max: 5 },
  (near) => {
    orthoCameraCmp.set({ near })
  }
)
gui.addParam(
  'Far',
  orthoCameraCmp,
  'far',
  { min: 5, max: 20},
  (far) => {
    orthoCameraCmp.set({ far })
  }
)
gui.addParam(
  'Zoom',
  orthoCameraCmp,
  'zoom',
  { min: 1, max: 5 },
  (zoom) => {
    orthoCameraCmp.set({ zoom })
  }
)

const axisCmp = axisHelper({color : [0,0,1,1],scale : 3})
const gridCmp = gridHelper()

const helperEntity = renderer.entity(
  [
    axisCmp,
    gridCmp
  ]
)
renderer.add(helperEntity)

gui.addFPSMeeter()
ctx.frame(() => {
  renderer.draw()
  gui.draw()
})

async function loadScene(url, transformProps) {
  let scene
  scene = await renderer.loadScene(url, {
    includeCameras: false
  })

  scene.entities.forEach((entity) => {
    const materialCmp = entity.getComponent('Material')
    if (materialCmp) {
      materialCmp.set({
        castShadows: true,
        receiveShadows: true,
        depthWrite: true
      })
    }
    
    entity.addComponent(bBoxHelper())
  })
  const transformCmp = scene.root.getComponent('Transform')
  if (transformCmp && transformProps) {
    transformCmp.set(transformProps)
  }

  renderer.add(scene.root)
  //window.dispatchEvent(new CustomEvent('pex-screenshot'))
}
