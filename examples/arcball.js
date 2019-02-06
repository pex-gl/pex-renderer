const createRenderer = require('../')
const createContext = require('pex-context')
const createCube = require('primitive-cube')
const { makeAxes } = require('./helpers')

const ctx = createContext()

const renderer = createRenderer(ctx)

const cameraEntity = renderer.entity([
  renderer.transform({
    position: [0, 0, 5],
  }),
  renderer.camera({
    fov: Math.PI / 4,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  })
])
renderer.add(cameraEntity)

const cubeEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry(createCube()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 1
  }),
  renderer.orbiter({
    element: ctx.gl.canvas,
  })
])
renderer.add(cubeEntity)

const axes = makeAxes(10)
const axesEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry({
    positions: axes,
    primitive: ctx.Primitive.Lines,
    count: axes.length,
    vertexColors: [
      [1, 0, 0, 1],
      [1, 0.8, 0, 1],
      [0, 1, 0, 1],
      [0.8, 1, 0, 1],
      [0, 0, 1, 1],
      [0, 0.8, 1, 1]
    ]
  }),
  renderer.material({
    baseColor: [1, 1, 1, 1]
  })
])
renderer.add(axesEntity)

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbeEntity)

ctx.frame(() => {
  renderer.draw()
})
