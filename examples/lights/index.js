const createRenderer = require('../../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat') // TODO: use latest pex-math
const createCube = require('primitive-cube')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const gridCells = require('grid-cells')
const {
  makeCircle,
  makePrism,
  makeQuad
} = require('./helpers.js')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx,
  shadowQuality: 2
})

const gui = createGUI(ctx)

const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 2
const nH = 2
let debugOnce = false

// Utils
const cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  // flip upside down as we are using viewport coordinates
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

cells.forEach((cell, cellIndex) => {
  const tags = ['cell' + cellIndex]
  const cameraEntity = renderer.entity([
    renderer.camera({
      fov: Math.PI / 3,
      aspect: (W / nW) / (H / nH),
      viewport: cell
    }),
    renderer.orbiter()
  ], tags)
  renderer.add(cameraEntity)
})

// Geometry
dragon.positions = centerAndNormalize(dragon.positions)
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

// Meshes
const dragonEntity = renderer.entity([
  renderer.geometry(dragon),
  renderer.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true
  })
])
renderer.add(dragonEntity)

const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.42, 0]
  }),
  renderer.geometry(createCube(5, 0.1, 5)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false
  })
])
renderer.add(floorEntity)

// Lights
// Directional
const directionalLightCmp = renderer.directionalLight({
  direction: vec3.normalize([-1, -1, -1]),
  color: [1, 1, 1, 1],
  intensity: 2,
  castShadows: true
})
const directionalLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat([
    [0, 0, 0.3], [0, 0, 1],
    [0.3, 0, 0], [0.3, 0, 1],
    [-0.3, 0, 0], [-0.3, 0, 1],
    [0, 0.3, 0], [0, 0.3, 1],
    [0, -0.3, 0], [0, -0.3, 1]
  ])

const directionalLightEntity = renderer.entity([
  renderer.transform({
    position: [1, 1, 1],
    rotation: quat.fromDirection(quat.create(), directionalLightCmp.direction)
  }),
  renderer.geometry({
    positions: directionalLightGizmoPositions,
    primitive: ctx.Primitive.Lines,
    count: directionalLightGizmoPositions.length
  }),
  renderer.material({
    baseColor: [1, 1, 0, 1]
  }),
  directionalLightCmp
], ['cell0'])
renderer.add(directionalLightEntity)

gui.addHeader('Directional').setPosition(10, 10)
gui.addParam('Enabled', directionalLightCmp, 'enabled', {}, (value) => {
  directionalLightCmp.set({ enabled: value })
})
gui.addTexture2D('Directional Shadowmap', directionalLightCmp._shadowMap)
gui.addParam('Shadows', directionalLightCmp, 'castShadows', {}, (value) => {
  directionalLightCmp.set({ castShadows: value })
})

// Spot
const spotLightCmp = renderer.spotLight({
  direction: vec3.normalize([-1, -1, -1]),
  color: [1, 1, 1, 1],
  intensity: 2,
  distance: 3,
  angle: Math.PI / 6,
  castShadows: true
})
const spotLightRadius = spotLightCmp.distance * Math.tan(spotLightCmp.angle)
const spotLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat([
    [0, 0, 0], [spotLightRadius, 0, spotLightCmp.distance],
    [0, 0, 0], [-spotLightRadius, 0, spotLightCmp.distance],
    [0, 0, 0], [0, spotLightRadius, spotLightCmp.distance],
    [0, 0, 0], [0, -spotLightRadius, spotLightCmp.distance]
  ])
  .concat(makeCircle({ radius: spotLightRadius, center: [0, 0, spotLightCmp.distance], steps: 64, axis: [0, 1] }))

const spotLightEntity = renderer.entity([
  renderer.transform({
    position: [1, 1, 1],
    rotation: quat.fromDirection(quat.create(), spotLightCmp.direction)
  }),
  renderer.geometry({
    positions: spotLightGizmoPositions,
    primitive: ctx.Primitive.Lines,
    count: spotLightGizmoPositions.length
  }),
  renderer.material({
    baseColor: [1, 0, 1, 1]
  }),
  spotLightCmp
], ['cell1'])
renderer.add(spotLightEntity)

gui.addHeader('Spot').setPosition(W / 2 + 10, 10)
gui.addParam('Enabled', spotLightCmp, 'enabled', {}, (value) => {
  spotLightCmp.set({ enabled: value })
})
gui.addParam('Spotlight angle', spotLightCmp, 'angle', { min: 0, max: Math.PI / 2 }, () => {
  spotLightCmp.set({ angle: spotLightCmp.angle })
})

// Point
const pointLightCmp = renderer.pointLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  radius: 3,
  castShadows: true
})
const pointLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLightCmp.radius, steps: 64, axis: [0, 1] }))
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLightCmp.radius, steps: 64, axis: [0, 2] }))
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLightCmp.radius, steps: 64, axis: [1, 2] }))
  .concat([
    [0, 0.3, 0], [0, 0.6, 0],
    [0, -0.3, 0], [0, -0.6, 0],
    [0.3, 0, 0], [0.6, 0, 0],
    [-0.3, 0, 0], [-0.6, 0, 0],
    [0, 0, 0.3], [0, 0, 0.6],
    [0, 0, -0.3], [0, 0, -0.6]
  ])

const pointLightEntity = renderer.entity([
  renderer.transform({
    position: [1, 1, 1]
  }),
  renderer.geometry({
    positions: pointLightGizmoPositions,
    primitive: ctx.Primitive.Lines,
    count: pointLightGizmoPositions.length
  }),
  renderer.material({
    baseColor: [1, 1, 1, 1]
  }),
  pointLightCmp
], ['cell2'])
renderer.add(pointLightEntity)

gui.addHeader('Point').setPosition(10, H / 2 + 10)
gui.addParam('Enabled', pointLightCmp, 'enabled', {}, (value) => {
  pointLightCmp.set({ enabled: value })
})
gui.addTextureCube('Shadowmap', pointLightCmp._shadowCubemap)
gui.addParam('Position', pointLightEntity.getComponent('Transform'), 'position', { min: -2, max: 2 })
gui.addParam('Shadows', pointLightCmp, 'castShadows', {}, (value) => {
  pointLightCmp.set({ castShadows: value })
})

// Area
const areaLightCmp = renderer.areaLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  castShadows: true
})
const areaLightGizmoPositions = makeQuad({ width: 1, height: 1 })

const areaLightEntity = renderer.entity([
  renderer.transform({
    scale: [2, 0.5, 1],
    position: [1, 1, 1],
    rotation: quat.fromDirection(quat.create(), [-1, -1, -1])
  }),
  renderer.geometry({
    positions: areaLightGizmoPositions,
    primitive: ctx.Primitive.Lines,
    count: areaLightGizmoPositions.length
  }),
  renderer.material({
    baseColor: [0, 1, 1, 1]
  }),
  areaLightCmp
], ['cell3'])
renderer.add(areaLightEntity)

gui.addHeader('Area').setPosition(W / 2 + 10, H / 2 + 10)
gui.addParam('Enabled', areaLightCmp, 'enabled', {}, (value) => {
  areaLightCmp.set({ enabled: value })
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') gui.toggleEnabled()
  if (e.key === 'd') debugOnce = true
})

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
