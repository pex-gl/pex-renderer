const createRenderer = require('../')
const createContext = require('pex-context')
const createSphere = require('primitive-sphere')
const random = require('pex-random')
const { vec3, quat } = require('pex-math')
const ctx = createContext()
const renderer = createRenderer(ctx)
const createGUI = require('pex-gui')
const gui = createGUI(ctx)
gui.addHeader('Settings')

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    exposure: 1,
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter({ element: ctx.gl.canvas }),
  renderer.postProcessing({
    ssao: true,
    ssaoRadius: 1,
    bloom: true,
    bloomRadius: 0.5,
    bloomThreshold: 99,
    bloomIntensity: 1
  })
])
renderer.add(cameraEntity)

const directionalLightEntity = renderer.entity(
  [
    renderer.transform({
      position: [1, 1, 1],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([-1, -1, -1])
      )
    }),
  
    renderer.material({
      baseColor: [1, 1, 0, 1]
    }),
    renderer.directionalLight({
      color: [1, 1, 1, 1],
      intensity: 4,
      castShadows: true
    })//,
    //renderer.lightHelper()
  ],
  ['cell0']
)
renderer.add(directionalLightEntity)

random.seed(0)
for (var i = 0; i < 64; i++) {
  const emit = random.chance(0.2)
  const sphereEntity = renderer.entity([
    renderer.transform({
      position: random.vec3(2)
    }),
    renderer.geometry(createSphere(emit ? 0.25 : 0.5)),
    renderer.material({
      //baseColor: emit ? [3.15, 2.3, 0.3, 1] : [1, 1, 1, 1],
      baseColor: [0, 0, 0, 1],
      emissiveColor: emit ? [3.15, 2.3, 0.3, 1] : [0, 0, 0, 1],
      metallic: 0,
      roughness: 0.85,
      castShadows: true,
      receiveShadows: true
    })
  ])
  renderer.add(sphereEntity)
}


const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

ctx.frame(() => {
  const now = Date.now() * 0.0005

  const skybox = skyboxEntity.getComponent('Skybox')
  skybox.set({
    //sunPosition: [1 * Math.cos(now), 1, 1 * Math.sin(now)]
  })

  renderer.draw()
  gui.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
