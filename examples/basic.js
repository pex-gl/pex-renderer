const createRenderer = require('../')
const createContext = require('pex-context')
const createSphere = require('primitive-sphere')

const ctx = createContext()
const renderer = createRenderer(ctx)

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 5] }),
  renderer.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  })
])
renderer.add(cameraEntity)

const sphereEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry(createSphere()),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    metallic: 1
  })
])
renderer.add(sphereEntity)

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 0.1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbeEntity)

ctx.frame(() => {
  const now = Date.now() * 0.0005

  const skybox = skyboxEntity.getComponent('Skybox')
  skybox.set({
    sunPosition: [
      1 * Math.cos(now),
      0.1,
      1 * Math.sin(now)
    ]
  })

  renderer.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
