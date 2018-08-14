const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const createRenderer = require('../../')
const createSphere = require('primitive-sphere')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const gridCells = require('grid-cells')
const parseHdr = require('parse-hdr')
const path = require('path')

const ctx = createContext({
  powerPreference: 'high-performance'
})
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')
ctx.gl.getExtension('EXT_texture_filter_anisotropic')

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') gui.toggleEnabled()
})

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: false,
  exposure: 1
}

random.seed(10)

const renderer = createRenderer({
  pauseOnBlur: true,
  ctx: ctx,
  // profile: true,
  rgbm: State.rgbm,
  shadowQuality: 2
})

const gui = createGUI(ctx)
gui.setEnabled(false)
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)

function updateSunPosition () {
  // mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  // mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  // vec3.set3(State.sunPosition, 10, 0, 0)
  // vec3.multMat4(State.sunPosition, State.elevationMat)
  // vec3.multMat4(State.sunPosition, State.rotationMat)

  // if (State.sun) {
    // var sunDir = State.sun.direction
    // vec3.set(sunDir, [0, 0, 0])
    // vec3.sub(sunDir, State.sunPosition)
    // State.sun.set({ direction: sunDir })
  // }

  // if (State.skybox) {
    // State.skybox.set({ sunPosition: State.sunPosition })
  // }

  // if (State.reflectionProbe) {
    // State.reflectionProbe.dirty = true // FIXME: hack
  // }
}

const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 7
const nH = 3

// flip upside down as we are using viewport coordinates
let cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

function initCamera () {
  cells.forEach((cell, cellIndex) => {
    const tags = ['cell' + cellIndex]
    const material = materials[cellIndex]
    const cameraCmp = renderer.camera({
      fov: Math.PI / 3,
      aspect: (W / nW) / (H / nH),
      near: 0.1,
      far: 100,
      viewport: cell,
      postprocess: true,
      fxaa: true,
      exposure: State.exposure
    })
    if (material.emissiveColor) {
      cameraCmp.set({
        bloom: true,
        bloomIntensity: 0.5,
        bloomThreshold: 3,
        bloomRadius: 1.25
      })
    }
    renderer.add(renderer.entity([
      cameraCmp,
      renderer.orbiter({
        position: [0, 0, 1.5]
      })
    ], tags))
  })

  gui.addParam('Exposure', State, 'exposure', { min: 0.01, max: 5 }, () => {
    renderer.getComponents('Camera').forEach((camera) => {
      camera.set({ exposure: State.exposure })
    })
  })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })
}

function imageFromFile (file, options) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.SRGB
  })
  io.loadImage(file, function (err, image, encoding) {
    console.log('image loaded', file)
    if (err) console.log(err)
    ctx.update(tex, {
      data: image,
      width: image.width,
      height: image.height,
      wrap: ctx.Wrap.Repeat,
      flipY: true,
      mag: ctx.Filter.Linear,
      min: ctx.Filter.LinearMipmapLinear,
      aniso: 16,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: encoding
    })
    ctx.update(tex, { mipmap: true })
  }, true)
  return tex
}

let materials = [
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 0 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 1 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 2 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 3 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 4 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 5 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 6 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 0 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 1 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 2 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 3 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 4 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 5 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 6 / 6 },
  { roughness: null,
    metallic: null,
    baseColor: [1, 1, 1, 0.5],
    baseColorMap: ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png'
  },
  {
    baseColorMap: ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png',
    roughnessMap: ASSETS_DIR + '/plastic-green.material/plastic-green_roughness.png',
    metallicMap: ASSETS_DIR + '/plastic-green.material/plastic-green_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-green.material/plastic-green_n.png'
  },
  {
    baseColorMap: ASSETS_DIR + '/plastic-red.material/plastic-red_basecolor.png',
    roughnessMap: ASSETS_DIR + '/plastic-red.material/plastic-red_roughness.png',
    metallicMap: ASSETS_DIR + '/plastic-red.material/plastic-red_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-red.material/plastic-red_n.png'
  },
  {
    baseColorMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_basecolor.png',
    roughnessMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_roughness.png',
    metallicMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_n.png',
    emissiveColor: [1, 1, 1, 1],
    emissiveColorMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_emissive.png',
    emissiveIntensity: 4
  },
  { roughness: 2 / 7, metallic: 0, baseColor: [0.1, 0.5, 0.8, 1.0] },
  { roughness: 3 / 7, metallic: 0, baseColor: [0.1, 0.1, 0.1, 1.0] },
  { roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One
  }
]

function initMeshes () {
  const geom = createSphere(0.5)

  materials.forEach((mat) => {
    if (mat.baseColorMap) mat.baseColorMap = imageFromFile(mat.baseColorMap, ctx.Encoding.SRGB)
    if (mat.roughnessMap) mat.roughnessMap = imageFromFile(mat.roughnessMap, ctx.Encoding.Linear)
    if (mat.metallicMap) mat.metallicMap = imageFromFile(mat.metallicMap, ctx.Encoding.Linear)
    if (mat.normalMap) mat.normalMap = imageFromFile(mat.normalMap, ctx.Encoding.Linear)
    if (mat.emissiveColorMap) mat.emissiveColorMap = imageFromFile(mat.emissiveColorMap, ctx.Encoding.SRGB)
  })

  cells.forEach((cell, cellIndex) => {
    const tags = ['cell' + cellIndex]
    const material = materials[cellIndex]
    if (!material) return
    const components = [
      renderer.geometry(geom),
      renderer.material(material)
    ]
    const entity = renderer.entity(components, tags)
    console.log(entity)
    renderer.add(entity)
  })
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2
  })
  const sunTransform = renderer.transform({
    position: [2, 2, 2],
    rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([-2, -2, -2]))
  })
  renderer.add(renderer.entity([
    sunTransform,
    sun
  ]))

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition,
    texture: panorama
  })
  renderer.add(renderer.entity([ skybox ]))

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })
  renderer.add(renderer.entity([ reflectionProbe ]))
  gui.addTextureCube('Reflection Cubemap', reflectionProbe._dynamicCubemap).setPosition(180, 10)
  gui.addTexture2D('Reflection OctMap', reflectionProbe._octMap)
  gui.addTexture2D('Reflection OctMapAtlas', reflectionProbe._reflectionMap)
}

initCamera()
initMeshes()

io.loadBinary(`${ASSETS_DIR}/garage.hdr`, (err, buf) => {
  if (err) console.log('Loading HDR file failed', err)
  const hdrImg = parseHdr(buf)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })
  gui.addTexture2D('Panorama', panorama)
  initSky(panorama)
})

let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') {
    debugOnce = true
    updateSunPosition()
  }
})

updateSunPosition()

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  if (!renderer._state.paused) { // TODO: _state.something is messy
    gui.draw()
  }
})
