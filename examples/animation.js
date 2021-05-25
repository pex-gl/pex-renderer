const createRenderer = require('..')
const createContext = require('pex-context')
const createGUI = require('pex-gui')

const ctx = createContext()
const renderer = createRenderer(ctx)

const State = {
  animation: [],
  animationName: ''
}

const gui = createGUI(ctx)

// Scene entities
const cameraEntity = renderer.entity([
  renderer.camera({
    far: 10000,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  renderer.orbiter({
    position: [-100, 100, 100]
  })
])
renderer.add(cameraEntity)

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const axesEntity = renderer.entity([renderer.axisHelper({ scale: 100 })])
renderer.add(axesEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)
;(async () => {
  const scene = await renderer.loadScene('glTF-Sample-Models/Fox/glTF/Fox.gltf')
  const animationMixer = renderer.animationMixer()
  scene.root.addComponent(animationMixer)
  renderer.add(scene.root)

  State.animationNames = scene.root.components.filter(
    (component) => component.type === 'Animation'
  )

  const onAnimationSelect = () => {
    animationMixer.set({
      currentAnimation: {
        name: State.animationName,
        autoplay: true,
        loop: true
      }
    })
  }

  // GUI
  gui.addHeader('Animation Mixer')
  gui.addParam('Enabled', animationMixer, 'enabled', {}, (value) => {
    animationMixer.set({ enabled: value })
  })
  gui.addRadioList(
    'Animation',
    State,
    'animationName',
    State.animationNames.map(({ name }) => ({ name, value: name })),
    onAnimationSelect
  )
})()

ctx.frame(() => {
  renderer.draw()
  gui.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
