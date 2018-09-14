const createContext = require('pex-context')
const createRenderer = require('../..')
const createSphere = require('primitive-sphere')
const normals = require('geom-normals')
const GUI = require('pex-gui')
const random = require('pex-random')
const vec3 = require('pex-math').vec3

const ctx = createContext({ })
const gui = new GUI(ctx)
gui.addFPSMeeter()
gui.addHeader('Meshes')

random.seed(0)

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.01,
    far: 100,
    postprocess: false
  }),
  renderer.orbiter({
    easing: 0.1,
    distance: 3
  })
])
renderer.add(camera)

var g = createSphere(1, { segments: 400 })
var scale = 1

function perlin (p) {
  var s = scale
  var n = 0
  for (var i = 0; i < 5; i++) {
    n += random.noise3(p[0] * s, p[1] * s, p[2] * s) / s
    s *= 2
  }
  return n
}
for (var i = 0; i < g.positions.length; i++) {
  var p = g.positions[i]
  var n = perlin(p)
  vec3.addScaled(p, g.normals[i], n * 0.4)
}
g.normals = normals(g.positions, g.cells)

const geom = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(g),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    rougness: 0.096,
    metallic: 0,
    cullFace: false
  })
])
renderer.add(geom)
gui.addLabel('Sphere verts: ' + g.positions.length)

const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbe)

ctx.frame(() => {
  renderer.draw()
  gui.draw()
})
