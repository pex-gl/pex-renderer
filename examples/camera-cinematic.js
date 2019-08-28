const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const { utils } = require('pex-math')
const { toDegrees } = utils

const fitRect = require('fit-rect')

const ctx = createContext({})
const renderer = createRenderer(ctx)
const gui = createGUI(ctx)
const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

const sunEntity = renderer.entity([
  renderer.transform({
    position: [4.708013534545898, 13.164156913757324, -8.227595329284668],
    rotation: [
      0.4214527904987335,
      -0.16269956529140472,
      -0.2949129343032837,
      0.8419814705848694
    ]
  }),
  renderer.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 100,
    castShadows: true
  })
])
renderer.add(sunEntity)

const rendererState = {
  resolutionPreset: 0,
  resolutions: [[1920, 1080], [1080, 1920]]
}

gui.addHeader('Render Viewport')
gui.addRadioList(
  'Resolution',
  rendererState,
  'resolutionPreset',
  [
    { name: '1920 x 1080 (16:9)', value: 0 },
    { name: '1080 x 1910 (9:16)', value: 1 }
  ],
  resize
)

let camera = null
let sensorRectOverlay = null

const cameraState = {
  focalLength: 50,
  aspect: 1,
  xfov: 60,
  yfov: 60,
  // xfov: ((camera.fov * camera.aspect) / Math.PI) * 180,
  // yfov: (camera.fov / Math.PI) * 180,
  resolutionPreset: '16 x 9'
}

function resize() {
  console.log('resize')

  if (!camera) return

  const windowBounds = [0, 0, window.innerWidth, window.innerHeight]

  ctx.set({ width: windowBounds[2], height: windowBounds[3] })

  const [renderWidth, renderHeight] = rendererState.resolutions[
    rendererState.resolutionPreset
  ]
  const rendererBounds = [0, 0, renderWidth, renderHeight]
  const cameraViewport = fitRect(rendererBounds, windowBounds)
  const sensorBounds = [0, 0, camera.sensorSize[0], camera.sensorSize[1]]
  let sensorFitBounds = [0, 0, 0.1, 0.1]

  const sensorAspectRatio = camera.sensorSize[0] / camera.sensorSize[1]
  const cameraAspectRatio = renderWidth / renderHeight
  let yfov = Math.PI / 2
  let sensorWidth = camera.sensorSize[0]
  let sensorHeight = camera.sensorSize[1]
  if (cameraAspectRatio > sensorAspectRatio) {
    if (camera.sensorFit === 'vertical' || camera.sensorFit === 'overscan') {
      sensorFitBounds = fitRect(sensorBounds, cameraViewport)
      yfov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength)
    } else {
      //horizontal || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, 'cover')
      sensorHeight = sensorWidth / cameraAspectRatio
      yfov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength)
    }
  } else {
    if (camera.sensorFit === 'horizontal' || camera.sensorFit === 'overscan') {
      sensorFitBounds = fitRect(sensorBounds, cameraViewport)
      sensorHeight = sensorWidth / cameraAspectRatio
      yfov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength)
    } else {
      //vertical || fill
      sensorFitBounds = fitRect(sensorBounds, cameraViewport, 'cover')
      yfov = 2 * Math.atan(sensorHeight / 2 / camera.focalLength)
    }
  }

  console.log('sensorFitBounds', sensorFitBounds)
  sensorRectOverlay.set({
    x: sensorFitBounds[0],
    y: sensorFitBounds[1],
    width: sensorFitBounds[2],
    height: sensorFitBounds[3]
  })

  camera.set({ viewport: cameraViewport })
  camera.set({ fov: yfov })
}

window.addEventListener('resize', resize)

async function initScene() {
  const scene = await renderer.loadScene(
    'assets/models/dof-reference/dof-reference.gltf',
    { includeCameras: true }
  )
  renderer.add(scene.root)

  const cameraEnt = scene.entities.filter((e) => e.getComponent('Camera'))[0]
  camera = cameraEnt.getComponent('Camera')

  // cameraState.focalLength = filmHeight / 2 / Math.tan(camera.fov / 2)
  cameraState.focalLength = 50

  gui.addHeader('Camera Lens')
  gui.addParam(
    'focalLength (mm)',
    cameraState,
    'focalLength',
    { min: 0, max: 100 },
    () => {
      /*
      const focalLength = cameraState.focalLength
      const filmHeight = cameraState.filmHeight
      const yfov = 2 * Math.atan(filmHeight / 2 / focalLength)
      cameraState.yfov = toDegrees(yfov)
      cameraState.xfov = toDegrees(yfov * cameraState.aspect)
      camera.set({ fov: yfov })
      */
    }
  )
  gui.addParam('xfov', cameraState, 'xfov', { min: 0, max: 180 }, () => {
    // camera.set({ fov: (cameraState.yfov / 180) * Math.PI })
  })

  gui.addParam('yfov', cameraState, 'yfov', { min: 0, max: 180 }, () => {
    camera.set({ fov: (cameraState.yfov / 180) * Math.PI })
  })
  console.log(scene, camera)

  gui.addHeader('Camera Sensor')
  gui.addParam(
    'Sensor width (mm)',
    camera.sensorSize,
    '0',
    { min: 0, max: 100 },
    () => {
      camera.set({ sensorSize: camera.sensorSize })
    }
  )

  gui.addParam(
    'Sensor height (mm)',
    camera.sensorSize,
    '1',
    {
      min: 0,
      max: 100
    },
    () => {
      camera.set({ sensorSize: camera.sensorSize })
    }
  )

  gui.addRadioList(
    'Sensor fit',
    camera,
    'sensorFit',
    [
      { name: 'Vertical', value: 'vertical' },
      { name: 'Horizontal', value: 'horizontal' },
      { name: 'Fill', value: 'fill' },
      { name: 'Overscan', value: 'overscan' }
    ],
    () => {
      // set value again to trigger fieldOfView change
      camera.set({ sensorFit: camera.sensorFit })
      resize()
    }
  )

  let rectCanvas = document.createElement('canvas')
  rectCanvas.width = camera.sensorSize[0] * 10
  rectCanvas.height = camera.sensorSize[1] * 10
  let rectCtx = rectCanvas.getContext('2d')
  rectCtx.strokeStyle = '#00DD00'
  rectCtx.lineWidth = 3
  rectCtx.strokeRect(0, 0, rectCanvas.width, rectCanvas.height)

  const rectTexture = ctx.texture2D({
    data: rectCanvas,
    width: 360,
    height: 240
  })

  sensorRectOverlay = renderer.overlay({
    texture: rectTexture,
    x: 2,
    y: 2,
    width: 500,
    height: 100
  })
  var sensorRectOverlayEnt = renderer.entity([sensorRectOverlay])

  renderer.add(sensorRectOverlayEnt)

  resize()
}

initScene()

ctx.frame(() => {
  const now = Date.now() * 0.0005

  const skybox = skyboxEntity.getComponent('Skybox')
  skybox.set({
    sunPosition: [1 * Math.cos(now), 1, 1 * Math.sin(now)]
  })

  renderer.draw()

  gui.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
