const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const createRenderer = require('../../')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const isBrowser = require('is-browser')
dragon.positions = centerAndNormalize(dragon.positions).map((v) => vec3.scale(v, 5))
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])
const parseHdr = require('parse-hdr')
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const State = {
  sunPosition: [0, 1, -5],
  elevation: 25,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: false
}

random.seed(10)

const renderer = createRenderer({
  ctx: ctx,
  profile: true,
  shadowQuality: 3,
  pauseOnBlur: true,
  rgbm: State.rgbm
})

const gui = createGUI(ctx)

let debugOnce = false
let sunEntity = null
let reflectionProbeEntity = null
let skyboxEntity = null
let cameraEntity = null
let pointLight1 = null
let areaLight = null
let panorama = null
let entities = []

function updateSunPosition () {
  mat4.identity(State.elevationMat)
  mat4.identity(State.rotationMat)
  mat4.rotate(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  mat4.rotate(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  var sunPos = [2, 0, 0]
  vec3.multMat4(sunPos, State.elevationMat)
  vec3.multMat4(sunPos, State.rotationMat)

  var dir = vec3.normalize(vec3.sub([0, 0, 0], sunPos))
  sunEntity.transform.set({
    position: sunPos,
    rotation: quat.fromTo(sunEntity.transform.rotation, [0, 0, 1], dir, [0, 1, 0])
  })
  skyboxEntity.getComponent('Skybox').set({ sunPosition: sunPos })
  reflectionProbeEntity.getComponent('ReflectionProbe').set({ dirty: true })
}

function initCamera () {
  cameraEntity = renderer.add(renderer.entity([
    renderer.camera({
      fov: Math.PI / 3,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      ssao: true,
      fxaa: false,
      dof: true,
      dofDepth: 18,
      exposure: 2,
      postprocess: true
    }),
    renderer.orbiter({
      position: [0, 2, 20]
    })
  ]))
}

const ASSETS_DIR = isBrowser ? 'assets' : `${__dirname}/assets`

function initMeshes () {
  const baseColorMap = imageFromFile(ASSETS_DIR + '/plastic-basecolor.png', { encoding: ctx.Encoding.SRGB })
  const normalMap = imageFromFile(ASSETS_DIR + '/plastic-normal.png', { encoding: ctx.Encoding.Linear })
  const metallicMap = imageFromFile(ASSETS_DIR + '/plastic-metallic.png', { encoding: ctx.Encoding.Linear })
  const roughnessMap = imageFromFile(ASSETS_DIR + '/plastic-roughness.png', { encoding: ctx.Encoding.Linear })
  const alphaMap = imageFromFile(ASSETS_DIR + '/checker.png', { encoding: ctx.Encoding.Linear })
  const groundCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.01)
  const roundedCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.2)
  const capsule = createCapsule(0.3)
  const sphere = createSphere(0.5)
  const geometries = [capsule, roundedCube, sphere]

  random.seed(14)

  for (var i = 0; i < 20; i++) {
    renderer.add(renderer.entity([
      renderer.transform({
        position: vec3.scale(random.vec3(), 2)
      }),
      renderer.geometry(sphere),
      renderer.material({
        baseColor: [0.07, 0.06, 0.00, 1.0],
        roughness: 0.2,
        metallic: 0,
        castShadows: true,
        receiveShadows: true
      })
    ]))
  }

  renderer.add(renderer.entity([
    renderer.transform({
      position: [0, -2.2, 0],
      scale: [20, 0.2, 7]
    }),
    renderer.geometry(groundCube),
    renderer.material({
      baseColor: [0.15, 0.15, 0.2, 1.0],
      roughness: 1,
      metallic: 0,
      // alphaMap: alphaMap,
      // alphaTest: 0.5,
      castShadows: true,
      receiveShadows: true
    })
  ]))

  const dragonEnt = renderer.entity([
    renderer.transform({
      position: [0, -0.4, 2]
    }),
    renderer.geometry(dragon),
    renderer.material({
      baseColor: [0.8, 0.8, 0.8, 1.0],
      roughness: 1,
      metallic: 0,
      castShadows: true,
      receiveShadows: true
    })
  ])
  entities.push(dragonEnt)
  renderer.add(dragonEnt)

  for (let j = -5; j <= 5; j += 2) {
    for (let i = 0; i < geometries.length; i++) {
      const geom = geometries[i]
      const x = j
      const y = 1.5 * (1 - i)
      const z = 0
      const entity = renderer.entity([
        renderer.transform({
          position: [x, y, z]
        }),
        renderer.geometry(geom),
        renderer.material({
          baseColor: [0.9, 0.9, 0.9, 1],
          roughness: (j + 5) / 10,
          metallic: 0.0, // 0.01, // (j + 5) / 10,
          baseColorMap: baseColorMap,
          roughnessMap: roughnessMap,
          metallicMap: metallicMap,
          normalMap: normalMap,
          castShadows: true,
          receiveShadows: true
        })
      ])
      entities.push(entity)
      renderer.add(entity)
    }
  }
}

function initSky (panorama) {
  sunEntity = renderer.add(renderer.entity([
    renderer.transform({
      position: State.sunPosition,
      rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize(vec3.scale(vec3.copy(State.sunPosition), -1)))
    }),
    renderer.directionalLight({
      color: [1, 1, 0.95, 1],
      intensity: 4,
      castShadows: true
    })
  ]))

  skyboxEntity = renderer.add(renderer.entity([
    renderer.skybox({
      sunPosition: State.sunPosition,
      texture: panorama
    })
  ]))

  // currently this also includes light probe functionality
  reflectionProbeEntity = renderer.add(renderer.entity([
    renderer.reflectionProbe({
      origin: [0, 0, 0],
      size: [10, 10, 10],
      boxProjection: false
    })
  ]))

  updateSunPosition()
}

function initLights () {
  pointLight1 = renderer.entity([
    renderer.geometry(createSphere(0.2)),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    }),
    renderer.transform({
      position: [2, 2, 2]
    }),
    renderer.pointLight({
      color: [1, 0, 0, 1],
      intensity: 3,
      radius: 10
    })
  ])
  renderer.add(pointLight1)

  areaLight = renderer.entity([
    renderer.geometry(createCube()),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [2.0, 1.2, 0.1, 1]
    }),
    renderer.transform({
      position: [0, 3, 0],
      scale: [5, 1, 0.1],
      rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([0, -1, 0.001]))
    }),
    renderer.areaLight({
      color: [2.0, 1.2, 0.1, 1],
      intensity: 2,
      castShadows: true
    })
  ])
  renderer.add(areaLight)
}

function imageFromFile (file, options) {
  // console.log('loading', file)
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
  io.loadImage(file, function (err, image) {
    // console.log('image loaded', file)
    if (err) console.log(err)
    ctx.update(tex, {
      data: image,
      width: image.width,
      height: image.height,
      mipmap: true,
      min: ctx.Filter.LinearMipmapLinear
    })
  }, true)
  return tex
}

function initGUI () {
  const cameraCmp = cameraEntity.getComponent('Camera')

  // Scene
  gui.addTab('Scene')
  gui.addColumn('Environment')
  gui.addHeader('Sun')
  gui.addParam('Enabled', sunEntity.getComponent('DirectionalLight'), 'enabled', {}, (value) => {
    sunEntity.getComponent('DirectionalLight').set({ enabled: value })
  })
  gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
  gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)
  gui.addHeader('Panorama')
  gui.addTexture2D('Env map', panorama)

  gui.addColumn('Material')
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ baseColor: State.baseColor }) })
  })
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ roughness: State.roughness }) })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ metallic: State.metallic }) })
  })

  gui.addColumn('Lights')
  gui.addParam('Light 1 Enabled', pointLight1.getComponent('PointLight'), 'enabled', {}, (value) => {
    pointLight1.getComponent('PointLight').set({ enabled: value })
    pointLight1.getComponent('Transform').set({ enabled: value })
  })
  gui.addParam('Light 1 Pos', pointLight1.transform, 'position', { min: -5, max: 5 }, (value) => {
    pointLight1.transform.set({ position: value })
  })
  gui.addParam('Area Light 1 Enabled', areaLight.getComponent('AreaLight'), 'enabled', {}, (value) => {
    areaLight.getComponent('AreaLight').set({ enabled: value })
    areaLight.getComponent('Transform').set({ enabled: value })
  })
  gui.addParam('Area Light 1 Col', areaLight.getComponent('AreaLight'), 'color', { type: 'color' }, (value) => {
    areaLight.getComponent('AreaLight').set({ color: value })
    areaLight.getComponent('Material').set({ emissiveColor: value })
  })

  // PostProcess
  const postProcessTab = gui.addTab('PostProcess')
  postProcessTab.setActive()
  gui.addColumn('Parameters')
  gui.addParam('Enabled', cameraCmp, 'postprocess', {}, () => {
    // trigger update
    cameraCmp.set({ postprocess: cameraCmp.postprocess })
  })
  gui.addParam('Exposure', cameraCmp, 'exposure', { min: 0, max: 5 })
  gui.addParam('SSAO', cameraCmp, 'ssao')
  gui.addParam('SSAO radius', cameraCmp, 'ssaoRadius', { min: 0, max: 30 })
  gui.addParam('SSAO intensity', cameraCmp, 'ssaoIntensity', { min: 0, max: 10 })
  gui.addParam('SSAO bias', cameraCmp, 'ssaoBias', { min: 0, max: 1 })
  gui.addParam('SSAO blur radius', cameraCmp, 'ssaoBlurRadius', { min: 0, max: 5 })
  gui.addParam('SSAO blur sharpness', cameraCmp, 'ssaoBlurSharpness', { min: 0, max: 20 })
  gui.addParam('DOF', cameraCmp, 'dof')
  gui.addParam('DOF Iterations', cameraCmp, 'dofIterations', { min: 1, max: 5, step: 1 })
  gui.addParam('DOF Depth', cameraCmp, 'dofDepth', { min: 0, max: 20 })
  gui.addParam('DOF Range', cameraCmp, 'dofRange', { min: 0, max: 20 })
  gui.addParam('DOF Radius', cameraCmp, 'dofRadius', { min: 0, max: 20 })
  gui.addParam('FXAA', cameraCmp, 'fxaa')

  gui.addColumn('Render targets')
  gui.addTexture2D('Depth', cameraCmp._frameDepthTex)
  gui.addTexture2D('Normal', cameraCmp._frameNormalTex)
}

initCamera()
initMeshes()
initLights()

io.loadBinary(`${ASSETS_DIR}/Mono_Lake_B.hdr`, (err, buf) => {
  if (err) console.log('Loading HDR file failed', err)
  const hdrImg = parseHdr(buf)
  panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })

  initSky(panorama)
  initGUI()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
  if (e.key === 'g') gui.toggleEnabled()
})

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  var dist = vec3.distance(cameraEntity.transform.position, [0, 0.4, 2])
  cameraEntity.getComponent('Camera').set({
    dofDepth: dist,
    dofRange: dist / 4
  })

  if (!renderer._state.paused) {
    gui.draw()
  }
})

window.addEventListener('resize', () => {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.set({
    width: W,
    height: H
  })
  cameraEntity.getComponent('Camera').set({
    viewport: [0, 0, W, H],
    aspect: W / H
  })
})
