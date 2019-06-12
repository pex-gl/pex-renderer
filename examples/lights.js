const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const createCube = require('primitive-cube')
const dragon = require('./assets/stanford-dragon')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const gridCells = require('grid-cells')
const { makeCircle, makePrism, makeQuad } = require('./helpers.js')

function targetTo(out, eye, target, up = [0, 1, 0]) {
  let eyex = eye[0]
  let eyey = eye[1]
  let eyez = eye[2]
  let upx = up[0]
  let upy = up[1]
  let upz = up[2]
  let z0 = eyex - target[0]
  let z1 = eyey - target[1]
  let z2 = eyez - target[2]
  let len = z0 * z0 + z1 * z1 + z2 * z2
  if (len > 0) {
    len = 1 / Math.sqrt(len)
    z0 *= len
    z1 *= len
    z2 *= len
  }
  let x0 = upy * z2 - upz * z1
  let x1 = upz * z0 - upx * z2
  let x2 = upx * z1 - upy * z0
  len = x0 * x0 + x1 * x1 + x2 * x2
  if (len > 0) {
    len = 1 / Math.sqrt(len)
    x0 *= len
    x1 *= len
    x2 *= len
  }
  out[0] = x0
  out[1] = x1
  out[2] = x2
  out[3] = 0
  out[4] = z1 * x2 - z2 * x1
  out[5] = z2 * x0 - z0 * x2
  out[6] = z0 * x1 - z1 * x0
  out[7] = 0
  out[8] = z0
  out[9] = z1
  out[10] = z2
  out[11] = 0
  out[12] = eyex
  out[13] = eyey
  out[14] = eyez
  out[15] = 1
  return out
}

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx,
  shadowQuality: 4
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
  const cameraEntity = renderer.entity(
    [
      renderer.camera({
        fov: Math.PI / 3,
        aspect: W / nW / (H / nH),
        viewport: cell
      }),
      renderer.orbiter()
    ],
    tags
  )
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
    position: [0, -0.4, 0]
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
// Ambient
const ambientLightEntity = renderer.entity([
  renderer.ambientLight({
    color: [0.1, 0.1, 0.1, 1]
  })
])
renderer.add(ambientLightEntity)

// Directional
const directionalLightCmp = renderer.directionalLight({
  color: [1, 1, 1, 1],
  intensity: 1,
  castShadows: true
})
const directionalLightGizmoPositions = makePrism({ radius: 0.3 }).concat(
  /* prettier-ignore */ [
    [0, 0, 0.3], [0, 0, 1],
    [0.3, 0, 0], [0.3, 0, 1],
    [-0.3, 0, 0], [-0.3, 0, 1],
    [0, 0.3, 0], [0, 0.3, 1],
    [0, -0.3, 0], [0, -0.3, 1]
  ]
)

const directionalLightEntity = renderer.entity(
  [
    renderer.transform({
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
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
  ],
  ['cell0']
)
renderer.add(directionalLightEntity)

gui.addHeader('Directional').setPosition(10, 10)
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
gui.addTexture2D('Shadowmap', directionalLightCmp._shadowMap)
gui.addParam('Shadows', directionalLightCmp, 'castShadows', {}, (value) => {
  directionalLightCmp.set({ castShadows: value })
})

const fixDirectionalLightEntity = renderer.entity(
  [
    renderer.transform({
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
    }),
    renderer.geometry({
      positions: directionalLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: directionalLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [1, 1, 0, 1]
    }),
    renderer.directionalLight({
      color: [1, 1, 0, 1],
      intensity: 1,
      castShadows: true
    })
  ],
  ['cell0']
)
renderer.add(fixDirectionalLightEntity)

// Spot
const spotLightCmp = renderer.spotLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  range: 5,
  angle: Math.PI / 6,
  innerAngle: Math.PI / 12,
  castShadows: true
})
const spotLightDistance = 2
const spotLightRadius = spotLightDistance * Math.tan(spotLightCmp.angle)
const spotLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat([
    [0, 0, 0],
    [spotLightRadius, 0, spotLightDistance],
    [0, 0, 0],
    [-spotLightRadius, 0, spotLightDistance],
    [0, 0, 0],
    [0, spotLightRadius, spotLightDistance],
    [0, 0, 0],
    [0, -spotLightRadius, spotLightDistance]
  ])
  .concat(
    makeCircle({
      radius: spotLightRadius,
      center: [0, 0, spotLightDistance],
      steps: 64,
      axis: [0, 1]
    })
  )

const spotLightEntity = renderer.entity(
  [
    renderer.transform({
      position: [1, 0.5, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
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
  ],
  ['cell1']
)
renderer.add(spotLightEntity)

gui.addHeader('Spot').setPosition(W / 2 + 10, 10)
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
  { min: 0, max: 20 },
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
gui.addTexture2D('Shadowmap', spotLightCmp._shadowMap)
gui.addParam('Shadows', spotLightCmp, 'castShadows', {}, (value) => {
  spotLightCmp.set({ castShadows: value })
})

const fixSpotLightEntity = renderer.entity(
  [
    renderer.transform({
      position: [1, 0.5, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
    }),
    renderer.geometry({
      positions: spotLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: spotLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [1, 0, 1, 1]
    }),
    renderer.spotLight({
      color: [1, 1, 0, 1],
      intensity: 2,
      range: 5,
      angle: Math.PI / 6,
      innerAngle: Math.PI / 12,
      castShadows: true
    })
  ],
  ['cell1']
)
renderer.add(fixSpotLightEntity)

// Point
const pointLightCmp = renderer.pointLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  range: 5,
  castShadows: true
})
const pointLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat(
    makeCircle({
      center: [0, 0, 0],
      radius: pointLightCmp.range,
      steps: 64,
      axis: [0, 1]
    })
  )
  .concat(
    makeCircle({
      center: [0, 0, 0],
      radius: pointLightCmp.range,
      steps: 64,
      axis: [0, 2]
    })
  )
  .concat(
    makeCircle({
      center: [0, 0, 0],
      radius: pointLightCmp.range,
      steps: 64,
      axis: [1, 2]
    })
  )
  .concat(
    /* prettier-ignore */ [
      [0, 0.3, 0], [0, 0.6, 0],
      [0, -0.3, 0], [0, -0.6, 0],
      [0.3, 0, 0], [0.6, 0, 0],
      [-0.3, 0, 0], [-0.6, 0, 0],
      [0, 0, 0.3], [0, 0, 0.6],
      [0, 0, -0.3], [0, 0, -0.6]
    ]
  )

const pointLightEntity = renderer.entity(
  [
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
  ],
  ['cell2']
)
renderer.add(pointLightEntity)

gui.addHeader('Point').setPosition(10, H / 2 + 10)
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
gui.addTextureCube('Shadowmap', pointLightCmp._shadowCubemap)
gui.addParam('Shadows', pointLightCmp, 'castShadows', {}, (value) => {
  pointLightCmp.set({ castShadows: value })
})

const fixPointLightEntity = renderer.entity(
  [
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
    renderer.pointLight({
      color: [1, 1, 0, 1],
      intensity: 2,
      range: 5,
      castShadows: true
    })
  ],
  ['cell2']
)
renderer.add(fixPointLightEntity)

// Area
const areaLightCmp = renderer.areaLight({
  color: [1, 1, 1, 1],
  intensity: 4,
  castShadows: true
})
const areaLightGizmoPositions = makeQuad({ width: 1, height: 1 })

const areaLightEntity = renderer.entity(
  [
    renderer.transform({
      scale: [2, 0.5, 1],
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
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
  ],
  ['cell3']
)
renderer.add(areaLightEntity)

gui.addHeader('Area').setPosition(W / 2 + 10, H / 2 + 10)
gui.addParam('Enabled', areaLightCmp, 'enabled', {}, (value) => {
  areaLightCmp.set({ enabled: value })
})

const fixAreaLightEntity = renderer.entity(
  [
    renderer.transform({
      scale: [2, 0.5, 1],
      position: [1, 1, 1],
      rotation: quat.fromMat4(
        quat.create(),
        targetTo(mat4.create(), [0, 0, 0], [1, 1, 1])
      )
    }),
    renderer.geometry({
      positions: areaLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: areaLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [0, 1, 1, 1]
    }),
    renderer.areaLight({
      color: [1, 1, 0, 1],
      intensity: 4,
      castShadows: true
    })
  ],
  ['cell3']
)
renderer.add(fixAreaLightEntity)

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') gui.toggleEnabled()
  if (e.key === 'd') debugOnce = true
})

let delta = 0

ctx.frame(() => {
  delta += 0.005

  const position = [2 * Math.cos(delta), 1, 2 * Math.sin(delta)]
  const rotation = quat.fromMat4(
    quat.create(),
    targetTo(mat4.create(), position.map((n) => -n), [0, 0, 0])
  )

  directionalLightEntity.getComponent('Transform').set({ position, rotation })
  spotLightEntity.getComponent('Transform').set({ position, rotation })
  pointLightEntity.getComponent('Transform').set({ position })
  areaLightEntity.getComponent('Transform').set({ position, rotation })

  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
