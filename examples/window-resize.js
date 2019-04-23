const createRenderer = require('../')
const createContext = require('pex-context')
const vec3 = require('pex-math/vec3')
const createCube = require('primitive-cube')

const ctx = createContext()
const renderer = createRenderer({
  ctx,
  shadowQuality: 4
})

const postProcessingCmp = renderer.postProcessing({
  ssao: true,
  ssaoRadius: 3,
  ssaoIntensity: 0.5,
  bilateralBlur: true,
  dof: true,
  dofDepth: 4,
  dofRange: 2,
  fxaa: true
})

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 5] }),
  renderer.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  postProcessingCmp,
  renderer.orbiter()
])
renderer.add(cameraEntity)

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

const groundEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.55, 0]
  }),
  renderer.geometry(createCube(10, 0.1, 10)),
  renderer.material({
    receiveShadows: true,
    castShadows: true
  })
])
renderer.add(groundEntity)

const cubeEntity = renderer.entity([
  renderer.geometry(createCube(1, 1, 1)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    receiveShadows: true,
    castShadows: true
  })
])
renderer.add(cubeEntity)

window.addEventListener('resize', () => {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.set({
    width: W,
    height: H
  })
  cameraEntity.getComponent('Camera').set({
    viewport: [0, 0, W, H]
  })
})

ctx.frame(() => {
  cameraEntity.getComponent('Camera').set({
    dofDepth: vec3.length(cameraEntity.transform.position)
  })

  renderer.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
