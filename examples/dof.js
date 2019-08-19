const createContext = require('pex-context')
const createRenderer = require('../')
const createCube = require('primitive-cube')
const createPlane = require('primitive-plane')
const createGUI = require('pex-gui')
const io = require('pex-io')
const isBrowser = require('is-browser')

const ctx = createContext()
const gui = createGUI(ctx)
const renderer = createRenderer(ctx)

const viewportWidth = window.innerWidth * 0.34
const viewportHeight = window.innerHeight
const aspect = (ctx.gl.drawingBufferWidth * 0.333333) / ctx.gl.drawingBufferHeight

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
],['1.4'])
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
],['18'])
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
],['32'])
renderer.add(perspectiveCamera32)




const baseColorMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png',
  { encoding: ctx.Encoding.SRGB },
  true
)
const normalMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_n.png',
  { encoding: ctx.Encoding.Linear },
  true
)
const metallicMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_metallic.png',
  { encoding: ctx.Encoding.Linear },
  true
)
const roughnessMap = imageFromFile(
  ASSETS_DIR + '/plastic-green.material/plastic-green_roughness.png',
  { encoding: ctx.Encoding.Linear },
  true
)

const distancesMap = imageFromFile(
  ASSETS_DIR + '/textures/Distances/Distances.png',
  { encoding: ctx.Encoding.Linear },
  false
)

const geometry = createCube(0.7)
const plane = createPlane(0.5,0.25)
const cubeDistances = [1,2,4,8,16,32,64]
cubeDistances.forEach((val,i)=>{
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

  let planeMat = renderer.material({
    baseColor: [1,1,1,1],
    roughness: 0.2,
    metallic: 0.0,
    baseColorMap: distancesMap,
    alphaTest: 0.5,
    castShadows: true,
    receiveShadows: true,
  })

  const planeEntity = renderer.entity([
    renderer.transform({
      position: [0, 0.5, -val + 0.3],
      rotation : [ 0, 0.0000427, 0, -1 ],
      scale : [1+(i*0.4),1+(i*0.4),1+(i*0.4)]
    }),
    renderer.geometry(plane),
    planeMat
  ])

  planeMat.set({ baseColorMap: {
    texture: distancesMap,
    offset: [0, 1-(0.1*(i+1))],
    scale: [1, 0.1]
  }})

  renderer.add(planeEntity)
})


const aps = ['1.4','18','32'];
aps.forEach((letter,i) => {
  let plane = createPlane(0.5,0.25)
  
  let planeMat = renderer.material({
    baseColor: [1,1,1,1],
    roughness: 0.2,
    metallic: 0.0,
    baseColorMap: distancesMap,
    alphaTest: 0.5,
    castShadows: true,
    receiveShadows: true,
  })

  const planeEntity = renderer.entity([
    renderer.transform({
      position: [0, 0.7, -0.32],
      rotation : [ -0.4794255, 0, 0, 0.8775826 ],
      //rotation : [ 0, 0.0000427, 0, -1 ],
      scale : [0.7,0.7,0.7]
    }),
    renderer.geometry(plane),
    planeMat
  ],[aps[i]])

  planeMat.set({ baseColorMap: {
    texture: distancesMap,
    offset: [0, 1-(0.1*(cubeDistances.length + i + 1))],
    scale: [1, 0.1]
  }})
  renderer.add(planeEntity)
  console.log(12333)
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
    min: 1,
    max: 10
  },
  (value) => {
    let logVal = Math.pow(1.5,value)
    C1p4Post.set({ dofFocusDistance: (logVal - 1) })
    C18Post.set({ dofFocusDistance: (logVal - 1) })
    C32Post.set({ dofFocusDistance: (logVal - 1) })
  }
)


let C1p4Cam = perspectiveCamera1p4.getComponent('Camera')
let C18Cam = perspectiveCamera18.getComponent('Camera')
let C32Cam = perspectiveCamera32.getComponent('Camera')

gui.addHeader('Resolution Scale')
gui.addButton('0.5', () => {
  ctx.set({ pixelRatio: 0.5 })
  C1p4Cam.set({viewport:[0, 0, viewportWidth/2, viewportHeight/2]})
  C18Cam.set({viewport:[viewportWidth/2, 0, viewportWidth/2, viewportHeight/2]})
  C32Cam.set({viewport: [viewportWidth/2 + viewportWidth/2 - 1,0,viewportWidth/2,viewportHeight/2]})
})
gui.addButton('1', () => {
  ctx.set({ pixelRatio: 1 })
  C1p4Cam.set({viewport:[0, 0, viewportWidth, viewportHeight]})
  C18Cam.set({viewport:[viewportWidth, 0, viewportWidth, viewportHeight]})
  C32Cam.set({viewport: [viewportWidth + viewportWidth - 1,0,viewportWidth,viewportHeight]})
  
})
gui.addButton('2', () => {
  ctx.set({ pixelRatio: 2 })
  C1p4Cam.set({viewport:[0, 0, viewportWidth*2, viewportHeight*2]})
  C18Cam.set({viewport:[viewportWidth*2, 0, viewportWidth*2, viewportHeight*2]})
  C32Cam.set({viewport: [viewportWidth*2 + viewportWidth*2 - 1,0,viewportWidth*2,viewportHeight*2]})
})

ctx.frame(() => {
  renderer.draw()
  gui.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})

// Utils
function imageFromFile(file, options,mipmap) {
  let tex
  if(mipmap){
    tex = ctx.texture2D({
      data: [0, 0, 0, 0],
      width: 1,
      height: 1,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: options.encoding,
      wrap: ctx.Wrap.ClampToEdge,
      flipY: true,
      min: ctx.Filter.LinearMipmapLinear,
      mipmap: true,
      aniso: 16
    })
  } else {
    tex = ctx.texture2D({
      data: [0, 0, 0, 0],
      width: 1,
      height: 1,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: options.encoding,
      wrap: ctx.Wrap.ClampToEdge,
      flipY: true,
      min: ctx.Filter.Nearest,
      mipmap: false,
      aniso: 16
    })
  }
  io.loadImage(
    file,
    function(err, image) {
      if (err) throw err
      ctx.update(tex, {
        data: image,
        width: image.width,
        height: image.height,
        mipmap: false,
        min: ctx.Filter.Nearest
      })
    },
    true
  )
  return tex
}