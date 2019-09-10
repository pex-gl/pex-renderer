// 3 cameras (perspective, ortho, perspective debug 3rd eye view)
//  4 lights (one per type)
//  static mesh
//  animated mesh
//  animated skinned mesh (cesium man from the repo would work)
//  instanced mesh

const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const io = require('pex-io')
const { quat, vec3 } = require('pex-math')
const GUI = require('pex-gui')
const isBrowser = require('is-browser')
const { loadText } = require('pex-io')
const createCube = require('primitive-cube')
const dragon = require('./assets/models/stanford-dragon/stanford-dragon')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')

const helperBBox = require('../helpers/bounding-box')

const State = {
  rotation: 1.5 * Math.PI
}
const ctx = createContext()
const renderer = createRenderer(ctx)
const gui = new GUI(ctx)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

// for (var i = 0; i < 3; i++) {
//   let orbiter = renderer.orbiter({ position: [0.5, 0.5, 2] })
//   let cameraCmp = false
//   let viewport = [
//     i * Math.floor((1 / 3) * window.innerWidth),
//     0,
//     Math.floor((1 / 3) * window.innerWidth),
//     window.innerHeight
//   ]

//   //// needs refactor
//   if (i == 1) {
//     cameraCmp = renderer.camera({
//       fov: Math.PI / 3,
//       projection: 'orthographic',
//       aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
//       near: 0.1,
//       far: 100,
//       postprocess: false,
//       viewport: viewport
//     })
//   } else {
//     cameraCmp = renderer.camera({
//       fov: Math.PI / 3,
//       aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
//       near: 0.1,
//       far: 100,
//       postprocess: false,
//       viewport: viewport
//     })
//   }
//   const camera = renderer.entity([
//     renderer.transform({ position: [0, 2, 3] }),
//     cameraCmp
//   ])
//   if (i == 2) {
//     camera.addComponent(orbiter)
//   }
//   renderer.add(camera)
// }

const orbitCameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
    viewport: 
      [ 
        0,
        0,
        window.innerWidth,
        window.innerHeight
      ]
  }),
  renderer.transform({ position: [0, 2, 3] }),
  renderer.orbiter({ position: [0.5, 0.5, 2] })
])
renderer.add(orbitCameraEntity)



const persCameraEntity = renderer.entity([
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false,
    viewport: 
      [ 
        0,
        window.innerHeight - (Math.floor((1 / 4) * window.innerHeight)),
        Math.floor((1 / 4) * window.innerWidth),
        Math.floor((1 / 4) * window.innerHeight)
      ]
  }),
  renderer.transform({ 
    position: [0, 2, 3],
    rotation: quat.fromEuler(quat.create(), [-Math.PI/5,0,0])
  }),
])
renderer.add(persCameraEntity)

const orthoCameraEntity = renderer.entity([
  renderer.camera({
    projection : 'orthographic',
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    viewport: 
      [ 
        [ 
          Math.floor((1 / 4) * window.innerWidth),
          window.innerHeight - (Math.floor((1 / 4) * window.innerHeight)),
          Math.floor((1 / 4) * window.innerWidth),
          Math.floor((1 / 4) * window.innerHeight)
        ]
      ]
  }),
  renderer.transform({ position: [1, 5, 5] }),
])
renderer.add(orthoCameraEntity)



// skybox and  reflection probe
const skybox = renderer.entity([
  renderer.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation)
  }),
  renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: true
  })
])
renderer.add(skybox)
const reflectionProbe = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbe)

//lights
const directionalLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([1, -3, -1]))
  }),
  renderer.directionalLight({
    castShadows: true,
    color: [1, 1, 1, 1],
    intensity: 5
  })
])
renderer.add(directionalLight)

const areaLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [1, 1, 0]
  }),
  renderer.areaLight({
    castShadows: true,
    color: [1, 1, 1, 1]
  })
])
renderer.add(areaLight)
const spotLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([1, -3, -1])
    ),
    position: [2, 1, 0]
  }),
  renderer.spotLight({
    castShadows: true,
    color: [1, 1, 1, 1]
  })
])
renderer.add(spotLight)



//floor
const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.4, 0]
  }),
  renderer.geometry(createCube(7, 0.1, 5)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    roughness: 2 / 5,
    metallic: 0,
    receiveShadows: true,
    castShadows: false
  })
])
renderer.add(floorEntity)

//static mesh
dragon.positions = centerAndNormalize(dragon.positions)
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

const dragonEntity = renderer.entity([
  renderer.geometry(dragon),
  renderer.material({
    baseColor: [0.5, 1, 0.7, 1],
    roughness: 0.27,
    metallic: 0.0,
    receiveShadows: true,
    castShadows: true
  }),
  renderer.transform({
    position: [-1.5, 0, 0]
  }),
  helperBBox()
])
renderer.add(dragonEntity)

//animated mesh
loadScene(`${ASSETS_DIR}/models/AnimatedMorphCube/AnimatedMorphCube.gltf`, {
  scale: [30, 30, 30],
  position: [-0.3, 0, 0]
})

//animated skinned mesh
loadScene(`${ASSETS_DIR}/models/CesiumMan/CesiumMan.gltf`, {
  scale: [0.8, 0.8, 0.8],
  position: [0.5, -0.35, 0]
})

//instanced mesh
const gridSize = 3
let grid = []
for (let i = 0; i < gridSize; i++) {
  for (let j = 0; j < gridSize; j++) {
    for (let k = 0; k < gridSize; k++) {
      grid.push([i/4, j/4 , k/4])
    }  
  }
}


let cubeG = createCube(0.1,0.1,0.1)
console.log(grid)
const instGeometry = renderer.geometry({
  positions: cubeG.positions,
  normals: cubeG.normals,
  uvs: cubeG.uvs,
  cells: cubeG.cells,
  offsets: { data: grid, divisor: 1 },
  instances: grid.length
})
let instEntity = renderer.entity([
  instGeometry,
  renderer.material({ 
    baseColor: [1, 0, 0, 1],
    castShadows : true,
    receiveShadows : true
  }),
  renderer.transform({position: [1.7,-0.2,0]}),
  helperBBox()
])

renderer.add(instEntity)

ctx.frame(() => {
  renderer.draw()
  gui.draw()
  //window.dispatchEvent(new CustomEvent('pex-screenshot'))
})

async function loadScene(url, transformProps) {
  let scene
  scene = await renderer.loadScene(url, {
    includeCameras: false
  })

  scene.entities.forEach((entity) => {
    const materialCmp = entity.getComponent('Material')
    if (materialCmp) {
      materialCmp.set({
        castShadows: true,
        receiveShadows: true
      })
    }
    const transformCmp = entity.getComponent('Transform')
    if (transformCmp && transformProps) {
      transformCmp.set(transformProps)
    }
  })

  renderer.add(scene.root)
}
