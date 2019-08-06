const createRenderer = require('../')
const createContext = require('pex-context')
const createCube = require('primitive-cube')
const random = require('pex-random')

random.seed(0)

const ctx = createContext()

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
  }),
  renderer.orbiter({ position: [1, 1, 1] })
])
renderer.add(camera)

const geometry = createCube()
geometry.vertexColors = geometry.uvs.map(() => [
  random.float(),
  random.float(),
  random.float(),
  0.5
])

const cubeEntity = renderer.entity([
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [1, 1, 1, 0.5],
    unlit: true
  })
])
renderer.add(cubeEntity)

const ambientLightEntity = renderer.entity([renderer.ambientLight()])
renderer.add(ambientLightEntity)

ctx.frame(() => {
  renderer.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
