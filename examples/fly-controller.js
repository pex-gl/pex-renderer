const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const random = require('pex-random')
const createCube = require('primitive-cube')
const cosineGradient = require('cosine-gradient')
// const parseHdr = require('parse-hdr')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 22,
  azimuth: 0,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create()
}
random.seed(100)

// Utils
const scheme = [
  [0.0, 0.5, 0.5],
  [0.0, 0.5, 0.5],
  [0.0, 0.5, 0.333],
  [0.0, 0.5, 0.667]
]

// Standard Normal constiate using Box-Muller transform.
// http://stackoverflow.com/a/36481059
function randnBM() {
  const u = 1 - Math.random() // Subtraction to flip [0, 1) to (0, 1].
  const v = 1 - Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function rand() {
  return (Math.random() * 2 - 1) * 3
}

const gradient = cosineGradient(scheme[0], scheme[1], scheme[2], scheme[3])

// Start
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('WEBGL_depth_texture')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx,
  shadowQuality: 4
})

const gui = createGUI(ctx)

let skybox = null
let frameNumber = 0
let debugOnce = false

// Camera
const cameraEntity = renderer.entity([
  renderer.postProcessing({
    ssao: true,
    ssaoRadius: true,
    dof: true,
    fxaa: true
  }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    exposure: 2,
    near: 0.1,
    far: 25
  }),
  renderer.flyControls({
    position: [0, 3, 8],
    releaseOnMouseUp: true
  })
])
renderer.add(cameraEntity)

// Meshes
const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.1, 0]
  }),
  renderer.geometry(createCube(14, 0.02, 14)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    castShadows: true,
    receiveShadows: true
  })
])
renderer.add(floorEntity)

let instanced = true
const cube = createCube(0.5, 0.5, 0.5)
const offsets = []
const scales = []
const colors = []
for (let i = 0; i < 100; i++) {
  const x = Math.random() * 10 - 5
  const z = Math.random() * 10 - 5
  const y = Math.random() * 3
  const s = Math.max(0.0, 12 - Math.sqrt(x * x + z * z) / 2)
  const c = random.float(0.7, 0.9)
  offsets.push([x, y, z])
  scales.push([1, 1, 1])
  colors.push([c, c, c, 1])
}
if (instanced) {
  cube.offsets = { buffer: ctx.vertexBuffer(offsets), divisor: 1 }
  cube.scales = { buffer: ctx.vertexBuffer(scales), divisor: 1 }
  cube.instances = offsets.length
  renderer.add(
    renderer.entity([
      renderer.geometry(cube),
      renderer.transform({}),
      renderer.material({
        baseColor: colors[0],
        rougness: 0.7,
        metallic: 0.0,
        castShadows: true,
        receiveShadows: true
      })
    ])
  )
} else {
  offsets.forEach((offset, i) => {
    renderer.add(
      renderer.entity([
        renderer.geometry(cube),
        renderer.transform({
          position: offset,
          scale: scales[i]
        }),
        renderer.material({
          baseColor: colors[i],
          rougness: 0.7,
          metallic: 0.0,
          castShadows: true,
          receiveShadows: true
        })
      ])
    )
  })
}

// Lights
const sunDir = vec3.normalize([1, -1, 1])
const sunPosition = vec3.addScaled([0, 0, 0], sunDir, -2)
const sunLight = renderer.directionalLight({
  color: [1, 1, 1, 1],
  intensity: 1,
  castShadows: true,
  bias: 0.1
})
const sunTransform = renderer.transform({
  position: [1, 1, 2],
  rotation: quat.fromTo([0, 0, 1], vec3.normalize([-1, -1, -1]), [0, 1, 0])
})
const sunEntity = renderer.entity([sunTransform, sunLight])
renderer.add(sunEntity)

gui.addTexture2D('Shadow Map', sunLight._shadowMap)

const skyboxCmp = renderer.skybox({
  sunPosition: sunPosition
})
const reflectionProbeCmp = renderer.reflectionProbe()
const skyEntity = renderer.entity([skyboxCmp, reflectionProbeCmp])
renderer.add(skyEntity)

// GUI

function updateSunPosition() {
  mat4.identity(State.elevationMat)
  mat4.identity(State.rotationMat)
  mat4.rotate(State.elevationMat, (State.elevation / 180) * Math.PI, [0, 0, 1])
  mat4.rotate(State.rotationMat, (State.azimuth / 180) * Math.PI, [0, 1, 0])

  const sunPosition = [5, 0, 0]
  vec3.multMat4(sunPosition, State.elevationMat)
  vec3.multMat4(sunPosition, State.rotationMat)

  const dir = vec3.normalize(vec3.sub([0, 0, 0], sunPosition))
  sunTransform.set({
    position: sunPosition,
    rotation: quat.fromTo(sunTransform.rotation, [0, 0, 1], dir, [0, 1, 0])
  })
  skyboxCmp.set({ sunPosition })
  reflectionProbeCmp.set({ dirty: true })
}
gui.addParam(
  'Sun Elevation',
  State,
  'elevation',
  { min: -90, max: 180 },
  updateSunPosition
)

updateSunPosition()

let debugAdded = 0

ctx.frame(() => {
  ctx.debug(frameNumber++ === 1)
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
  if (renderer.testTex && !debugAdded) {
    gui.addTexture2D('my pipeline', renderer.testTex)
    debugAdded = 1
  }
})
