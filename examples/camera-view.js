const createContext = require('pex-context')
const createRenderer = require('../')
const createCube = require('primitive-cube')
const { makeAxes } = require('./helpers')

const ctx = createContext()

const renderer = createRenderer(ctx)

const viewportWidth = window.innerWidth
const viewportHeight = window.innerHeight
const aspect = ctx.gl.drawingBufferWidth / 2 / ctx.gl.drawingBufferHeight
const columns = 3
const rows = 2
const viewWidth = viewportWidth / columns
const viewHeight = viewportHeight / rows
const viewSize = 5

for (let i = 0; i < rows; i++) {
  const n = i / rows

  for (let j = 0; j < columns; j++) {
    const m = j / columns

    const projection = i % 2 === 0 ? 'orthographic' : 'perspective'

    const options = projection === 'orthographic' ? {
      left: (-0.5 * viewSize * aspect) / 2,
      right: (0.5 * viewSize * aspect) / 2,
      top: (0.5 * viewSize) / 2,
      bottom: (-0.5 * viewSize) / 2
    } : {
      fov: Math.PI / 2
    }

    const camera = renderer.entity([
      renderer.camera({
        projection,
        exposure: j === 1 ? 2 : 1,
        aspect,
        viewport: [m * viewportWidth, n * viewportHeight, viewWidth, viewHeight],
        view: {
          offset: [m * viewportWidth, 0.5 * viewHeight],
          size: [viewWidth, viewHeight],
          totalSize: [viewportWidth, viewportHeight]
        },
        ...options
      }),
      renderer.orbiter({ position: [0, 1, 1] })
    ])
    renderer.add(camera)
  }
}

const axes = makeAxes(1)
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

const cubeEntity = renderer.entity([
  renderer.geometry(createCube()),
  renderer.material({
    baseColor: [0.5, 0, 0, 1]
  })
])
renderer.add(cubeEntity)

const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbe)

ctx.frame(() => {
  renderer.draw()
})
