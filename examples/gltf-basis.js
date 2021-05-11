const createRenderer = require('../')
const createContext = require('pex-context')
const { loadBinary } = require('pex-io')
const parseHdr = require('parse-hdr')
const { vec3 } = require('pex-math')
const { aabb } = require('pex-geom')

const ctx = createContext()
const renderer = createRenderer({ ctx })

const ASSETS_DIR = 'assets'

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

const addEnvmap = async () => {
  const buffer = await loadBinary(`${ASSETS_DIR}/envmaps/garage/garage.hdr`)
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    min: ctx.Filter.Linear,
    mag: ctx.Filter.Linear,
    flipY: true
  })

  skyboxEntity.getComponent('Skybox').set({ texture: panorama })
  reflectionProbeEntity.getComponent('ReflectionProbe').set({ dirty: true })
}
addEnvmap()

const axesEntity = renderer.entity([renderer.axisHelper({ scale: 1 })])
renderer.add(axesEntity)

let cameraEntity
const onResize = () => {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.set({
    width: W,
    height: H
  })
  if (cameraEntity) {
    cameraEntity.getComponent('Camera').set({
      viewport: [0, 0, W, H]
    })
  }
}

window.addEventListener('resize', onResize)
onResize()

async function load(url) {
  console.time('building ' + url)
  const scene = await renderer.loadScene(url, {
    includeCameras: true,
    basisOptions: {
      transcoderPath: 'assets/decoder/'
    }
  })
  console.timeEnd('building ' + url)

  renderer.add(scene.root)
  renderer.update()

  const far = 10000
  const sceneBounds = scene.root.transform.worldBounds
  const sceneCenter = aabb.center(scene.root.transform.worldBounds)

  const boundingSphereRadius = Math.max(
    ...sceneBounds.map((bound) => vec3.distance(sceneCenter, bound))
  )

  const fov = Math.PI / 4
  const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2)

  cameraEntity = renderer.entity([
    renderer.camera({
      near: 0.01,
      far,
      fov,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
    }),
    renderer.orbiter({
      maxDistance: far,
      target: sceneCenter,
      position: [sceneCenter[0], sceneCenter[1], distance]
    })
  ])
  scene.entities.push(cameraEntity)
  renderer.add(cameraEntity)
  onResize()

  ctx.frame(() => {
    renderer.draw()

    window.dispatchEvent(new CustomEvent('pex-screenshot'))
  })
}

let url = 'assets/models/basisu/BarramundiFish/BarramundiFish.mixed.glb'
url = 'assets/models/basisu/FlightHelmet/FlightHelmet.gltf'
load(url)
