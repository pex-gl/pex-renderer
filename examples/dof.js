const createContext = require('pex-context')
const createRenderer = require('../')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')

const ctx = createContext()
const gui = createGUI(ctx)
const renderer = createRenderer(ctx)

const viewportWidth = window.innerWidth * 0.34
const viewportHeight = window.innerHeight
const aspect = (ctx.gl.drawingBufferWidth * 0.5) / ctx.gl.drawingBufferHeight

const cubeCount = 100
const offset = 2
const gridSize = 10
const viewSize = gridSize / 2

const State = {
  dofFocusDistance : 5
}



const perspectiveCamera1p4 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 1010,
    aspect,
    viewport: [0, 0, viewportWidth, viewportHeight]
  }),
  renderer.transform({
    position: [0,1.5,0],
    rotation: [ -0.247404, 0, 0, 0.9689124 ]
  }),
  renderer.postProcessing({
    dof : true,
    dofAperture : 1.4,
    dofFocusDistance : State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera1p4)

const perspectiveCamera18 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 1010,
    aspect,
    viewport: [viewportWidth, 0, viewportWidth, viewportHeight]
  }),
  renderer.transform({
    position: [0,1.5,0],
    rotation: [ -0.247404, 0, 0, 0.9689124 ]
  }),
  renderer.postProcessing({
    dof: true,
    dofAperture : 18,
    dofFocusDistance : State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera18)

const perspectiveCamera32 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 1010,
    aspect,
    viewport: [viewportWidth + viewportWidth -1, 0, viewportWidth, viewportHeight]
  }),
  renderer.transform({
    position: [0,1.5,0],
    rotation: [ -0.247404, 0, 0, 0.9689124 ]
  }),
  renderer.postProcessing({
    dof: true,
    dofAperture : 32,
    dofFocusDistance : State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera32)




const geometry = createCube(1)
const cubeEntity = renderer.entity([
  renderer.transform({
    position: [0,0,-1]
  }),
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1
  })
])
renderer.add(cubeEntity)
const cubeEntity2 = renderer.entity([
  renderer.transform({
    position: [0,0,-5]
  }),
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1
  })
])
renderer.add(cubeEntity2)
const cubeEntity3 = renderer.entity([
  renderer.transform({
    position: [0,0,-20]
  }),
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1
  })
])
renderer.add(cubeEntity3)
const cubeEntity4 = renderer.entity([
  renderer.transform({
    position: [0,0,-100]
  }),
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    metallic: 0,
    roughness: 1
  })
])
renderer.add(cubeEntity4)


const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbe)

let C1p4 = perspectiveCamera1p4.getComponent('PostProcessing')
let C18 = perspectiveCamera18.getComponent('PostProcessing')
let C32 = perspectiveCamera18.getComponent('PostProcessing')

gui.addParam('DOF Focus Distance', State, 'dofFocusDistance', {
  min: 0,
  max: 100
}, (value) => {
  C1p4.set({dofFocusDistance:value})
  C18.set({dofFocusDistance:value})
  C32.set({dofFocusDistance:value})
})

ctx.frame(() => {
  renderer.draw()
  gui.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
