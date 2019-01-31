const createRenderer = require('../')
const createContext = require('pex-context')
const createCube = require('primitive-cube')
const { makeAxes } = require('./helpers')

const ctx = createContext({
  width: window.innerWidth * 0.8,
  height: window.innerWidth * 0.5
})
ctx.gl.canvas.style.margin = '20px auto'
ctx.gl.canvas.style.display = 'block'

const renderer = createRenderer(ctx)

// Utils
// generate random content below
document.body.style.width = '100%'
document.body.style.margin = 0
const container = document.createElement('div')
container.style.width = ((window.innerWidth * 0.8) | 0) + 'px'
container.style.margin = '0 auto'
container.style.display = 'block'
document.body.appendChild(container)

for (let i = 0; i < 20; i++) {
  const block = document.createElement('div')
  block.style.background = '#DDDDEE'
  block.style.width = (50 + Math.random() * 50) + '%'
  block.style.height = (50) + 'px'
  block.style.margin = '0 0 20px 0'
  container.appendChild(block)
}

const cameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter({
    element: ctx.gl.canvas,
    minLat: -30,
    maxLat: 30,
    minLon: -90,
    maxLon: 90
  })
])
renderer.add(cameraEntity)

const cubeEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry(createCube()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 1
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
