const createRenderer = require('../')
const createContext = require('pex-context')
const createSphere = require('primitive-sphere')
const { makeAxes } = require('./helpers')

const ctx = createContext()
const renderer = createRenderer(ctx)

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 5] }),
  renderer.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter()
])
renderer.add(cameraEntity)

const sphereEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry(createSphere()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 1
  })
])
renderer.add(sphereEntity)

const axes = makeAxes(2)
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
