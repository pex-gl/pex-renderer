const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const aabb = require('pex-geom/aabb')
const random = require('pex-random')
const io = require('pex-io')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const parseHdr = require('parse-hdr')
const isBrowser = require('is-browser')
const dragon = require('./assets/models/stanford-dragon/stanford-dragon')

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

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
  rgbm: false,
  autofocus: true
}

random.seed(14)

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx: ctx,
  profile: true,
  shadowQuality: 3,
  rgbm: State.rgbm
})

const gui = createGUI(ctx)

let debugOnce = false
let entities = []

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

// Scale scene to macro, 1m -> 5cm
const s = 0.05
const scene = renderer.entity([
  renderer.transform({ scale: [s, s, s] })
])

renderer.add(scene)

// Geometry
dragon.positions = centerAndNormalize(dragon.positions).map((v) => vec3.scale(v, 2))
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])
const dragonBounds = aabb.fromPoints(dragon.positions)

// Camera
const cameraEntity = renderer.add(
  renderer.entity([
    renderer.postProcessing({
      // enabled: false,
      ssao: true,
      fxaa: false,
      dof: true,
      dofFocusDistance: 18
    }),
    renderer.camera({
      fov: Math.PI / 4,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      exposure: 2,
      fStop: 1.4
    }),
    renderer.orbiter({
      position: [0, 0.2, 1]
    })
  ])
)

// Meshes
const baseColorMap = imageFromFile(
  ASSETS_DIR + '/materials/plastic-green.material/plastic-green_basecolor.png',
  { encoding: ctx.Encoding.SRGB }
)
const normalMap = imageFromFile(
  ASSETS_DIR + '/materials/plastic-green.material/plastic-green_n.png',
  { encoding: ctx.Encoding.Linear }
)
const metallicMap = imageFromFile(
  ASSETS_DIR + '/materials/plastic-green.material/plastic-green_metallic.png',
  { encoding: ctx.Encoding.Linear }
)
const roughnessMap = imageFromFile(
  ASSETS_DIR + '/materials/plastic-green.material/plastic-green_roughness.png',
  { encoding: ctx.Encoding.Linear }
)
const groundCube = createCube(10, 0.02, 5)
const roundedCube = createRoundedCube(0.75, 0.75, 0.75, 20, 20, 20, 0.2)
const capsule = createCapsule(0.25)
const sphere = createSphere(0.3)
const geometries = [capsule, roundedCube, sphere]

// Ground
const groundEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.02 / 2, 1]
  }),
  renderer.geometry(groundCube),
  renderer.material({
    baseColor: [0.15, 0.15, 0.2, 1.0],
    roughness: 1,
    metallic: 0,
    castShadows: true,
    receiveShadows: true
  })
])
renderer.add(groundEntity, scene)

const backgroundStuffParent = renderer.entity([
  renderer.transform({
    position: [0, 0, 0],
    scale: [1, 1, 1]
  })
])
renderer.add(backgroundStuffParent, scene)

// Black Spheres
for (let i = 0; i < 20; i++) {
  const sphereEntity = renderer.entity([
    renderer.transform({
      position: vec3.add(random.vec3(), [0, 1, 0])
    }),
    renderer.geometry(sphere),
    renderer.material({
      baseColor: [0.07, 0.06, 0.0, 1.0],
      roughness: 0.2,
      metallic: 0,
      castShadows: true,
      receiveShadows: true
    })
  ])
  renderer.add(sphereEntity, backgroundStuffParent)
}

const dragonEntity = renderer.entity([
  renderer.transform({
    position: [0, -dragonBounds[0][1], 2.5]
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
renderer.add(dragonEntity, scene)
entities.push(dragonEntity)

const heights = [2.5, 1.4, 0.5]
// Capsules, rounded cubes, spheres
for (let j = -5; j <= 5; j += 2) {
  for (let i = 0; i < geometries.length; i++) {
    const geometry = geometries[i]
    const x = j * 0.6
    let y = heights[i]
    const z = 0
    const entity = renderer.entity([
      renderer.transform({
        position: [x, y, z]
      }),
      renderer.geometry(geometry),
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
    renderer.add(entity, backgroundStuffParent)
    entities.push(entity)
  }
}

// Lights
const pointLightEntity = renderer.entity([
  renderer.geometry(createSphere(0.1)),
  renderer.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [1, 0, 0, 1]
  }),
  renderer.transform({
    position: [2, 2, 2]
  }),
  renderer.pointLight({
    color: [1, 0, 0, 1],
    intensity: 0.05,
    radius: 3
  })
])
renderer.add(pointLightEntity, scene)

const areaLightEntity = renderer.entity([
  renderer.geometry(createCube()),
  renderer.material({
    baseColor: [0, 0, 0, 1],
    emissiveColor: [2.0, 1.2, 0.1, 1]
  }),
  renderer.transform({
    position: [0, 3.5, 0],
    scale: [5, 1, 0.1],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([0, -1, 0.001])
    )
  }),
  renderer.areaLight({
    color: [2.0, 1.2, 0.1, 1],
    intensity: 2,
    castShadows: true
  })
])
renderer.add(areaLightEntity, backgroundStuffParent)

let cameraCmp
let postProcessingCmp
;(async () => {
  // Sky
  const buffer = await io.loadBinary(
    `${ASSETS_DIR}/envmaps/Mono_Lake_B/Mono_Lake_B.hdr`
  )
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    mag: ctx.Filter.Linear,
    min: ctx.Filter.Linear,
    flipY: true
  })

  const sunEntity = renderer.entity([
    renderer.transform({
      position: State.sunPosition,
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize(vec3.scale(vec3.copy(State.sunPosition), -1))
      )
    }),
    renderer.directionalLight({
      color: [1, 1, 0.95, 1],
      intensity: 2,
      castShadows: true,
      bias: 0.01
    })
  ])
  renderer.add(sunEntity)

  const skybox = renderer.skybox({
    sunPosition: State.sunPosition,
    texture: panorama
  })

  const reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })

  const skyEntity = renderer.entity([skybox, reflectionProbe])
  renderer.add(skyEntity)

  function updateSunPosition() {
    mat4.identity(State.elevationMat)
    mat4.identity(State.rotationMat)
    mat4.rotate(State.elevationMat, (State.elevation / 180) * Math.PI, [
      0,
      0,
      1
    ])
    mat4.rotate(State.rotationMat, (State.azimuth / 180) * Math.PI, [0, 1, 0])

    const sunPosition = [2, 0, 0]
    vec3.multMat4(sunPosition, State.elevationMat)
    vec3.multMat4(sunPosition, State.rotationMat)

    const dir = vec3.normalize(vec3.sub([0, 0, 0], sunPosition))
    sunEntity.transform.set({
      position: sunPosition,
      rotation: quat.fromTo(sunEntity.transform.rotation, [0, 0, 1], dir, [
        0,
        1,
        0
      ])
    })
    skyEntity.getComponent('Skybox').set({ sunPosition })
    skyEntity.getComponent('ReflectionProbe').set({ dirty: true })
  }

  updateSunPosition()

  // GUI
  cameraCmp = cameraEntity.getComponent('Camera')
  postProcessingCmp = cameraEntity.getComponent('PostProcessing')
  const skyboxCmp = skyEntity.getComponent('Skybox')
  const reflectionProbeCmp = skyEntity.getComponent('ReflectionProbe')

  // Scene
  gui.addTab('Scene')
  gui.addColumn('Environment')
  gui.addHeader('Sun')
  gui.addParam(
    'Enabled',
    sunEntity.getComponent('DirectionalLight'),
    'enabled',
    {},
    (value) => {
      sunEntity.getComponent('DirectionalLight').set({ enabled: value })
    }
  )
  gui.addParam(
    'Sun Elevation',
    State,
    'elevation',
    { min: -90, max: 180 },
    updateSunPosition
  )
  gui.addParam(
    'Sun Azimuth',
    State,
    'azimuth',
    { min: -180, max: 180 },
    updateSunPosition
  )
  gui.addHeader('Skybox')
  gui.addParam('Enabled', skyboxCmp, 'enabled', {}, (value) => {
    skyboxCmp.set({ enabled: value })
  })
  gui.addParam('Background Blur', skyboxCmp, 'backgroundBlur')
  gui.addTexture2D('Env map', skyboxCmp.texture)
  gui.addHeader('Reflection probes')
  gui.addParam('Enabled', reflectionProbeCmp, 'enabled', {}, (value) => {
    reflectionProbeCmp.set({ enabled: value })
  })

  gui.addColumn('Material')
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    entities.forEach((entity) => {
      entity.getComponent('Material').set({ baseColor: State.baseColor })
    })
  })
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    entities.forEach((entity) => {
      entity.getComponent('Material').set({ roughness: State.roughness })
    })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    entities.forEach((entity) => {
      entity.getComponent('Material').set({ metallic: State.metallic })
    })
  })

  gui.addColumn('Lights')
  gui.addParam(
    'Point Light Enabled',
    pointLightEntity.getComponent('PointLight'),
    'enabled',
    {},
    (value) => {
      pointLightEntity.getComponent('PointLight').set({ enabled: value })
      pointLightEntity.getComponent('Transform').set({ enabled: value })
    }
  )
  gui.addParam(
    'Point Light Pos',
    pointLightEntity.transform,
    'position',
    { min: -5, max: 5 },
    (value) => {
      pointLightEntity.transform.set({ position: value })
    }
  )
  gui.addParam(
    'Area Light Enabled',
    areaLightEntity.getComponent('AreaLight'),
    'enabled',
    {},
    (value) => {
      areaLightEntity.getComponent('AreaLight').set({ enabled: value })
      areaLightEntity.getComponent('Transform').set({ enabled: value })
    }
  )
  gui.addParam(
    'Area Light Col',
    areaLightEntity.getComponent('AreaLight'),
    'color',
    { type: 'color' },
    (value) => {
      areaLightEntity.getComponent('AreaLight').set({ color: value })
      areaLightEntity.getComponent('Material').set({ emissiveColor: value })
    }
  )

  // PostProcess
  const postProcessTab = gui.addTab('PostProcess')
  postProcessTab.setActive()
  gui.addColumn('Parameters')
  gui.addParam('Enabled', postProcessingCmp, 'enabled')
  gui.addParam('Exposure', cameraCmp, 'exposure', { min: 0, max: 5 })
  gui.addParam('SSAO', postProcessingCmp, 'ssao')
  gui.addParam('SSAO radius', postProcessingCmp, 'ssaoRadius', {
    min: 0,
    max: 30
  })
  gui.addParam('SSAO intensity', postProcessingCmp, 'ssaoIntensity', {
    min: 0,
    max: 10
  })
  gui.addParam('SSAO bias', postProcessingCmp, 'ssaoBias', { min: 0, max: 1 })
  gui.addParam('SSAO blur radius', postProcessingCmp, 'ssaoBlurRadius', {
    min: 0,
    max: 5
  })
  gui.addParam('SSAO blur sharpness', postProcessingCmp, 'ssaoBlurSharpness', {
    min: 0,
    max: 20
  })
  gui.addParam('DOF', postProcessingCmp, 'dof')
  gui.addParam('DOF Debug', postProcessingCmp, 'dofDebug')
  gui.addParam('DOF Focus Distance', postProcessingCmp, 'dofFocusDistance', {
    min: 0,
    max: 100
  })
  gui.addParam('DOF Autofocus', State, 'autofocus')
  gui.addParam(
    'Camera FoV',
    cameraCmp,
    'fov',
    {
      min: 0,
      max: (Math.PI / 3) * 2
    },
    () => {
      cameraCmp.set({ fov: cameraCmp.fov })
    }
  )
  gui.addParam(
    'Camera FocalLength',
    cameraCmp,
    'focalLength',
    {
      min: 10,
      max: 200
    },
    () => {
      cameraCmp.set({ focalLength: cameraCmp.focalLength })
    }
  )
  gui.addParam('Camera f-stop', cameraCmp, 'fStop', {
    min: 0,
    max: 5.6
  })

  gui.addParam('FXAA', postProcessingCmp, 'fxaa')

  gui.addParam('Bloom', postProcessingCmp, 'bloom')
  gui.addParam('Bloom threshold', postProcessingCmp, 'bloomThreshold', { min: 0, max: 2 })
  gui.addParam('Bloom intensity', postProcessingCmp, 'bloomIntensity', { min: 0, max: 5 })
  gui.addParam('Bloom radius', postProcessingCmp, 'bloomRadius', { min: 0, max: 10 })


  gui.addColumn('Render targets')
  if (postProcessingCmp.enabled) {
    gui.addTexture2D('Depth', postProcessingCmp._frameDepthTex)
    gui.addTexture2D('Normal', postProcessingCmp._frameNormalTex)
  }

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})()

// Events
window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
  if (e.key === 'g') gui.toggleEnabled()
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

// Frame
ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false

  if (State.autofocus && cameraCmp) {
    const distance = vec3.distance(
      dragonEntity.transform.worldPosition,
      cameraCmp.entity.transform.worldPosition
    )
    if (postProcessingCmp.dofFocuDistance !== distance) {
      postProcessingCmp.set({ dofFocusDistance: distance })
      // force redraw
      gui.items[0].dirty = true
    }
  }

  renderer.draw()
  gui.draw()
})
