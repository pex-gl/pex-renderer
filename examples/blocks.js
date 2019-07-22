const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const random = require('pex-random')
const createSphere = require('primitive-sphere')
const createCube = require('primitive-cube')
const cosineGradient = require('cosine-gradient')
// const parseHdr = require('parse-hdr')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: 0,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create()
}
random.seed(10)

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

const renderer = createRenderer(ctx)

const gui = createGUI(ctx)
gui.addFPSMeeter()

let frameNumber = 0
let debugOnce = false

// Camera
const cameraEntity = renderer.entity([
  renderer.postProcessing({
    ssao: true,
    ssaoRadius: 4,
    dof: true,
    fxaa: true
  }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    exposure: 2
  }),
  renderer.orbiter({ position: [0, 3, 8] })
])
renderer.add(cameraEntity)

// Meshes
const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.3, 0]
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
const cube = createCube(0.2, 0.5 + Math.random(), 0.2)
const offsets = []
const scales = []
const colors = []
for (let i = 0; i < 1000; i++) {
  const x = (randnBM() * 8) / 3
  const z = (randnBM() * 8) / 3
  const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
  const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
  const c = random.float(0.7, 0.9)
  offsets.push([x, y, z])
  scales.push([1, s, 1])
  colors.push([c, c, c, 1])
}
if (instanced) {
  cube.instanceOffsets = offsets 
  cube.instanceScales = scales
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

const sphere = createSphere(0.2 + Math.random() * 0.25)
for (let i = 0; i < 100; i++) {
  const x = (rand() * 8) / 3
  const z = (rand() * 8) / 3
  const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
  const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
  renderer.add(
    renderer.entity([
      renderer.geometry(sphere),
      renderer.transform({
        position: [x, y, z],
        scale: [s, s, s]
      }),
      renderer.material({
        baseColor: gradient(Math.random()).concat(1),
        rougness: 0.91,
        metallic: 0.0,
        castShadows: true,
        receiveShadows: true
      })
    ])
  )
}

// Lights
const sunDir = vec3.normalize([1, -1, 1])
const sunPosition = vec3.addScaled([0, 0, 0], sunDir, -2)
const sunLight = renderer.directionalLight({
  color: [1, 1, 1, 1],
  intensity: 2,
  castShadows: true,
  bias: 0.01
})
const sunTransform = renderer.transform({
  position: [2, 2, 2],
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

const pointLightEnt = renderer.entity([
  renderer.transform({
    position: [2, 2, 2]
  }),
  renderer.geometry(createSphere(0.2)),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1]
  }),
  renderer.pointLight({
    castShadows: true,
    color: [1, 0, 0, 1],
    intensity: 5
  })
])
renderer.add(pointLightEnt)

const areaLightColor = [0, 1, 0, 1]
const areaLightEntity = renderer.entity([
  renderer.transform({
    position: [5, 2, 0],
    scale: [2, 5, 0.1],
    rotation: quat.fromTo(quat.create(), [0, 0, 1], [-1, 0, 0], [0, 1, 0])
  }),
  renderer.geometry(createCube(1)),
  renderer.material({
    emissiveColor: areaLightColor,
    baseColor: [0, 0, 0, 1],
    metallic: 1.0,
    roughness: 0.74
  }),
  renderer.areaLight({
    intensity: 5,
    color: areaLightColor
  })
])
renderer.add(areaLightEntity)

// GUI
gui.addParam(
  'AreaLight Size',
  areaLightEntity.transform,
  'scale',
  { min: 0, max: 5 },
  (value) => {
    areaLightEntity.transform.set({ scale: [value[0], value[1], value[2]] })
  }
)
gui.addParam(
  'AreaLight Intensity',
  areaLightEntity.getComponent('AreaLight'),
  'intensity',
  { min: 0, max: 5 }
)
gui.addParam('AreaLight', areaLightEntity.getComponent('AreaLight'), 'color', {
  type: 'color'
})

function updateSunPosition() {
  mat4.identity(State.elevationMat)
  mat4.identity(State.rotationMat)
  mat4.rotate(State.elevationMat, (State.elevation / 180) * Math.PI, [0, 0, 1])
  mat4.rotate(State.rotationMat, (State.azimuth / 180) * Math.PI, [0, 1, 0])

  const sunPosition = [2, 0, 0]
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

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

ctx.frame(() => {
  ctx.debug(frameNumber++ === 1)
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
