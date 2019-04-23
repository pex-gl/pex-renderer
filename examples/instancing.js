const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const remap = require('pex-math/utils').map
const random = require('pex-random')
const createCube = require('primitive-cube')
const cosineGradient = require('cosine-gradient')

const State = {
  sunPosition: [0, 5, -5],
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

random.seed(10)

// Utils
const scheme = [[0.650, 0.500, 0.310], [-0.650, 0.500, 0.600], [0.333, 0.278, 0.278], [0.660, 0.000, 0.667]]
const scheme2 = [[0.500, 0.500, 0.000], [0.500, 0.500, 0.000], [0.100, 0.500, 0.000], [0.000, 0.000, 0.000]]
const gradient = cosineGradient(scheme)
const gradient2 = cosineGradient(scheme2)

// Start
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer(ctx)

const gui = createGUI(ctx)
gui.addFPSMeeter()

let frameNumber = 0
let debugOnce = false

// Camera
const cameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter({ position: [3, 3, 3] })
])
renderer.add(cameraEntity)

// Meshes
const n = 15
const cube = createCube(0.75 * 2 / n)
const offsets = []
const colors = []
const scales = []
const rotations = []

let time = 0
const geometry = renderer.geometry({
  positions: cube.positions,
  normals: cube.normals,
  cells: cube.cells,
  uvs: cube.uvs,
  offsets: { data: offsets, divisor: 1 },
  scales: { data: scales, divisor: 1 },
  rotations: { data: rotations, divisor: 1 },
  colors: { data: colors, divisor: 1 }
})
function update () {
  time += 1 / 60
  const center = [0.75, 0.75, 0.75]
  const radius = 1.25

  const center2 = [-0.75, -0.75, 0.75]
  const radius2 = 1.25

  center[0] = 1.15 * Math.sin(time)
  center[1] = 0.75 * Math.cos(time)

  center2[0] = -1.15 * Math.sin(time)
  center2[1] = 0.75 * Math.sin(time)
  center2[2] = 0.5 * Math.cos(time * 2) * Math.sin(time / 2)

  let i = 0
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      for (let z = 0; z < n; z++) {
        const pos = [
          remap(x, 0, n, -1, 1),
          remap(y, 0, n, -1, 1),
          remap(z, 0, n, -1, 1)
        ]
        const dist = vec3.distance(pos, center)
        if (dist < radius) {
          const force = vec3.sub(vec3.copy(pos), center)
          vec3.normalize(force)
          vec3.scale(force, 1 - Math.sqrt(dist / radius))
          vec3.add(pos, force)
        }
        const dist2 = vec3.distance(pos, center2)
        if (dist2 < radius2) {
          const force = vec3.sub(vec3.copy(pos), center2)
          vec3.normalize(force)
          vec3.scale(force, 1 - Math.sqrt(dist2 / radius2))
          vec3.add(pos, force)
        }
        offsets[i] = pos
        const value = Math.min(1, dist / radius)
        const value2 = Math.min(1, dist2 / radius2)
        const colorBase = [0.8, 0.1, 0.1, 1.0]
        const color = gradient(value)
        const color2 = gradient2(value2)
        vec3.lerp(colorBase, [0, 0, 0, 0], Math.sqrt(Math.max(0.01, 1 - value - value2)))
        vec3.lerp(color, [0, 0, 0, 0], value)
        vec3.lerp(color2, [0, 0, 0, 0], value2)
        vec3.add(colorBase, color)
        vec3.add(colorBase, color2)
        colors[i] = colorBase
        scales[i] = [1, 1, 4]
        const dir = vec3.normalize(vec3.sub(vec3.copy(pos), center))
        rotations[i] = quat.fromTo(quat.create(), [0, 0, 1], dir)
        i++
      }
    }
  }

  geometry.set({
    offsets: offsets,
    scales: scales,
    rotations: rotations,
    colors: colors,
    instances: offsets.length
  })
}
// update()
// setInterval(update, 1000 / 60)

const entity = renderer.entity([
  renderer.transform({
    position: [0, 0, 0]
  }),
  geometry,
  renderer.material({
    baseColor: [0.9, 0.9, 0.9, 1],
    roughness: 0.01,
    metallic: 1.0,
    castShadows: true,
    receiveShadows: true
  })
])
renderer.add(entity)

gui.addHeader('Material')
gui.addParam('Roughness', State, 'roughness', {}, () => {
  entity.getComponent('Material').set({ roughness: State.roughness })
})
gui.addParam('Metallic', State, 'metallic', {}, () => {
  entity.getComponent('Material').set({ metallic: State.metallic })
})
gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
  entity.getComponent('Material').set({ baseColor: State.baseColor })
})

// Sky
const sun = renderer.directionalLight({
  color: [5, 5, 4, 1],
  bias: 0.01,
  castShadows: true
})
gui.addTexture2D('Shadow map', sun._shadowMap).setPosition(10 + 170, 10)

const skybox = renderer.skybox({
  sunPosition: State.sunPosition
})
gui.addTexture2D('Sky', skybox._skyTexture)

const reflectionProbe = renderer.reflectionProbe({
  origin: [0, 0, 0],
  size: [10, 10, 10],
  boxProjection: false
})
gui.addTexture2D('ReflectionMap', reflectionProbe._reflectionMap)

renderer.add(renderer.entity([
  renderer.transform({
    position: State.sunPosition,
    rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize(vec3.sub([0, 0, 0], State.sunPosition)))
  }),
  sun,
  skybox,
  reflectionProbe
]))

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

ctx.frame(() => {
  ctx.debug(frameNumber++ < 2 || debugOnce)
  debugOnce = false

  update()

  renderer.draw()

  gui.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
