const createContext = require('pex-context')
const createRenderer = require('../')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const io = require('pex-io')
const isBrowser = require('is-browser')

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

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const State = {
  dofFocusDistance: 5
}

const perspectiveCamera1p4 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 70,
    aspect,
    viewport: [0, 0, viewportWidth, viewportHeight]
  }),
  renderer.transform({
    position: [0, 1.5, 0],
    rotation: [-0.247404, 0, 0, 0.9689124]
  }),
  renderer.postProcessing({
    dof: true,
    dofAperture: 1.4,
    dofFocusDistance: State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera1p4)

const perspectiveCamera18 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 70,
    aspect,
    viewport: [viewportWidth, 0, viewportWidth, viewportHeight]
  }),
  renderer.transform({
    position: [0, 1.5, 0],
    rotation: [-0.247404, 0, 0, 0.9689124]
  }),
  renderer.postProcessing({
    dof: true,
    dofAperture: 18,
    dofFocusDistance: State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera18)

const perspectiveCamera32 = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    far: 70,
    aspect,
    viewport: [
      viewportWidth + viewportWidth - 1,
      0,
      viewportWidth,
      viewportHeight
    ]
  }),
  renderer.transform({
    position: [0, 1.5, 0],
    rotation: [-0.247404, 0, 0, 0.9689124]
  }),
  renderer.postProcessing({
    dof: true,
    dofAperture: 32,
    dofFocusDistance: State.dofFocusDistance
  })
])
renderer.add(perspectiveCamera32)

const baseColorMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png',
  { encoding: ctx.Encoding.SRGB }
)
const normalMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_n.png',
  { encoding: ctx.Encoding.Linear }
)
const metallicMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_metallic.png',
  { encoding: ctx.Encoding.Linear }
)
const roughnessMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_roughness.png',
  { encoding: ctx.Encoding.Linear }
)

const geometry = createCube(0.7)
const cubeDistances = [1,2,4,8,16,32,64]
cubeDistances.forEach((val)=>{
  const cubeEntity = renderer.entity([
    renderer.transform({
      position: [0, 0, -val]
    }),
    renderer.geometry(geometry),
    renderer.material({
      baseColor: [0.9, 0.9, 0.9, 1],
      roughness: 0.2,
      metallic: 0.0, // 0.01, // (j + 5) / 10,
      baseColorMap: baseColorMap,
      roughnessMap: roughnessMap,
      metallicMap: metallicMap,
      normalMap: normalMap,
      castShadows: true,
      receiveShadows: true
    })
  ])
  renderer.add(cubeEntity)
})


const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbe)

let C1p4Post = perspectiveCamera1p4.getComponent('PostProcessing')
let C18Post = perspectiveCamera18.getComponent('PostProcessing')
let C32Post = perspectiveCamera32.getComponent('PostProcessing')
gui.addHeader('DOF Settings')
gui.addParam(
  'DOF Focus Distance',
  State,
  'dofFocusDistance',
  {
    min: 1.1,
    max: 70
  },
  (value) => {
    C1p4Post.set({ dofFocusDistance: value })
    C18Post.set({ dofFocusDistance: value })
    C32Post.set({ dofFocusDistance: value })
  }
)

// let C1p4Cam = perspectiveCamera1p4.getComponent('Camera')
// let C18Cam = perspectiveCamera18.getComponent('Camera')
// let C32Cam = perspectiveCamera32.getComponent('Camera')

// gui.addHeader('Resolution Scale')
// gui.addButton('0.5', () => {
//   C1p4Cam.set({viewport: [0, 0, viewportWidth/2, viewportHeight/2]})
//   C18Cam.set({viewport: [viewportWidth, 0, viewportWidth/2, viewportHeight/2]})
//   C32Cam.set({viewport: [ viewportWidth + viewportWidth - 1, 0, viewportWidth/2, viewportHeight/2] })
// })
// gui.addButton('1', () => {
//   C1p4Cam.set({viewport: [0, 0, viewportWidth, viewportHeight]})
//   C18Cam.set({viewport: [viewportWidth, 0, viewportWidth, viewportHeight]})
//   C32Cam.set({viewport: [ viewportWidth + viewportWidth - 1, 0, viewportWidth, viewportHeight] })
// })
// gui.addButton('2', () => {
//   C1p4Cam.set({viewport: [0, 0, viewportWidth*2, viewportHeight*2]})
//   C18Cam.set({viewport: [viewportWidth, 0, viewportWidth*2, viewportHeight*2]})
//   C32Cam.set({viewport: [ viewportWidth + viewportWidth - 1, 0, viewportWidth*2, viewportHeight*2] })
// })


gui.addHeader('Resolution Scale')
gui.addButton('0.5', () => {
  ctx.gl.canvas.style.width = window.innerWidth/2
  ctx.gl.canvas.style.height = window.innerHeight/2
  ctx.gl.canvas.style.transform = "scale(2,2)"
  ctx.gl.canvas.style.transformOrigin = "top left"
})
gui.addButton('1', () => {
  ctx.gl.canvas.style.width = window.innerWidth
  ctx.gl.canvas.style.height = window.innerHeight
  ctx.gl.canvas.style.transform = "scale(1,1)"
  ctx.gl.canvas.style.transformOrigin = "top left"
})
gui.addButton('2', () => {
  ctx.gl.canvas.style.width = window.innerWidth*2
  ctx.gl.canvas.style.height = window.innerHeight*2
  ctx.gl.canvas.style.transform = "scale(0.5,0.5)"
  ctx.gl.canvas.style.transformOrigin = "top left"
})

ctx.frame(() => {
  renderer.draw()
  gui.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})

// Utils
function imageFromFile(file, options) {
  const tex = ctx.texture2D({
    data: [0, 0, 0, 0],
    width: 1,
    height: 1,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: options.encoding,
    wrap: ctx.Wrap.Repeat,
    flipY: true,
    min: ctx.Filter.LinearMipmapLinear,
    mipmap: true,
    aniso: 16
  })
  io.loadImage(
    file,
    function(err, image) {
      if (err) throw err
      ctx.update(tex, {
        data: image,
        width: image.width,
        height: image.height,
        mipmap: true,
        min: ctx.Filter.LinearMipmapLinear
      })
    },
    true
  )
  return tex
}