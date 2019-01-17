const createContext = require('pex-context')
const createRenderer = require('../..')
const createCube = require('primitive-cube')

const ctx = createContext({
  width: window.innerWidth * 0.8,
  height: window.innerWidth * 0.5
})

document.body.style.width = '100%'
ctx.gl.canvas.style.margin = '20px auto'
ctx.gl.canvas.style.display = 'block'

// generate random content below
var container = document.createElement('div')
document.body.appendChild(container)
container.style.width = ((window.innerWidth * 0.8) | 0) + 'px'
container.style.margin = '0 auto'
container.style.display = 'block'
for (var i = 0; i < 20; i++) {
  var block = document.createElement('div')
  block.style.background = '#DDDDEE'
  block.style.width = (50 + Math.random() * 50) + '%'
  block.style.height = (50) + 'px'
  block.style.margin = '0 0 20px 0'
  container.appendChild(block)
}

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 2] }),
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
  }),
  renderer.orbiter({
    // enabled: false,
    element: ctx.gl.canvas,
    distance: 2,
    minLat: -30,
    maxLat: 30,
    minLon: -90,
    maxLon: 90
  })
])
renderer.add(camera)

const geom = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(createCube(1)),
  renderer.material({
    baseColor: [1, 0, 0, 1]
  })
])
renderer.add(geom)

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
