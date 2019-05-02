const createRenderer = require('../')
const createContext = require('pex-context')
const vec3 = require('pex-math/vec3')
const GUI = require('pex-gui')
const random = require('pex-random')
const normals = require('geom-normals')
const createSphere = require('primitive-sphere')

const ctx = createContext()
const renderer = createRenderer(ctx)

const gui = new GUI(ctx)
gui.addFPSMeeter()
gui.addHeader('Meshes')

random.seed(0)

const cameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter({
    position: [0, 0, 3]
  })
])
renderer.add(cameraEntity)

const sphere = createSphere(1, { segments: 400 })
const scale = 1

function perlin (p) {
  let s = scale
  let n = 0
  for (let i = 0; i < 5; i++) {
    n += random.noise3(p[0] * s, p[1] * s, p[2] * s) / s
    s *= 2
  }
  return n
}
for (let i = 0; i < sphere.positions.length; i++) {
  const p = sphere.positions[i]
  const n = perlin(p)
  vec3.addScaled(p, sphere.normals[i], n * 0.1)
}
sphere.normals = normals(sphere.positions, sphere.cells)

const sphereEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(sphere),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    roughness: 0.096,
    metallic: 0,
    cullFace: false
  })
])
renderer.add(sphereEntity)
gui.addLabel('Sphere verts: ' + sphere.positions.length)

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
  gui.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
