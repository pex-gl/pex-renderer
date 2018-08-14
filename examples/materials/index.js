const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const createRenderer = require('../../')
const createSphere = require('primitive-sphere')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const gridCells = require('grid-cells')
const parseHdr = require('parse-hdr')
const path = require('path')

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

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
  rgbm: true,
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
  mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  vec3.set3(State.sunPosition, 10, 0, 0)
  vec3.multMat4(State.sunPosition, State.elevationMat)
  vec3.multMat4(State.sunPosition, State.rotationMat)

  if (State.sun) {
    var sunDir = State.sun.direction
    vec3.set(sunDir, [0, 0, 0])
    vec3.sub(sunDir, State.sunPosition)
    State.sun.set({ direction: sunDir })
  }

  if (State.skybox) {
    State.skybox.set({ sunPosition: State.sunPosition })
  }

  if (State.reflectionProbe) {
    State.reflectionProbe.dirty = true // FIXME: hack
  }
}

const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 6
const nH = 3

// flip upside down as we are using viewport coordinates
let cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

function initCamera () {
  cells.forEach((cell, cellIndex) => {
    const tags = ['cell' + cellIndex]
    const cameraCmp = renderer.camera({
      fov: Math.PI / 3,
      aspect: (W / nW) / (H / nH),
      near: 0.1,
      far: 100,
      viewport: cell
    })
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
      min: ctx.Filter.Linear,
      mag: ctx.Filter.LinearMipmapLinear,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: encoding
    })
    ctx.update(tex, { mipmap: true })
  }, true)
  return tex
}

function initMeshes () {
  const geom = createSphere(0.5)

  let materials = [
    { roughness: 0 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 1 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 2 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 3 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 4 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 5 / 5, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 0 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 1 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 2 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 3 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 4 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 5 / 5, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    {
      baseColorMap: ASSETS_DIR + '/plastic-basecolor.png',
      roughnessMap: ASSETS_DIR + '/plastic-roughness.png',
      metallicMap: ASSETS_DIR + '/plastic-metallic.png',
      normalMap: ASSETS_DIR + '/plastic-normal.png'
    },
    {
      baseColorMap: ASSETS_DIR + '/plastic-basecolor-2.png',
      roughnessMap: ASSETS_DIR + '/plastic-roughness-2.png',
      metallicMap: ASSETS_DIR + '/plastic-metallic-2.png',
      normalMap: ASSETS_DIR + '/plastic-normal-2.png'
    },
    { roughness: 2 / 7, metallic: 0, baseColor: [0.1, 0.5, 0.8, 1.0] },
    { roughness: 3 / 7, metallic: 0, baseColor: [0.1, 0.1, 0.1, 1.0] },
    { roughness: 1, metallic: 0, baseColor: [0, 0, 0, 0], emissiveColor: [1, 0.5, 0, 1] }
    // { roughness: 0,
      // metallic: 0,
      // baseColor: [1, 1, 1, 0.2],
      // // FIXME: currently not working
      // blend: true,
      // blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
      // blendSrcAlphaFactor: ctx.BlendFactor.One,
      // blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
      // blendDstAlphaFactor: ctx.BlendFactor.One
    // }
  ]

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
    material.metallic = 0
    material.roughness = 1
    console.log('material', material)
    const components = [
      renderer.geometry(geom),
      renderer.material({
        baseColor: material ? material.baseColor || [1, 1, 1, 1] : [1, 1, 1, 1],
        baseColorMap: material ? material.baseColorMap : null,
        roughness: material ? material.roughness : 1.0,
        roughnessMap: material ? material.roughnessMap : null,
        metallic: material ? material.metallic : 0,
        metallicMap: material ? material.metallicMap : null,
        normalMap: material ? material.normalMap : null,
        emissiveColor: material ? (material.emissiveColor || [0, 0, 0, 1]) : [0, 0, 0, 1],
        emissiveColorMap: material ? material.emissiveColorMap : null
      })
    ]
    const entity = renderer.entity(components, tags)
    renderer.add(entity)
  })
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    direction: vec3.sub(vec3.create(), State.sunPosition),
    color: [1, 1, 0.95, 1],
    intensity: 5.5
  })

  const dot = State.dot = renderer.pointLight({
    color: [1, 0.01, 0.095, 1],
    intensity: 10,
    radius: 20
  })

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition,
    texture: panorama
  })

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })
  gui.addTextureCube('Reflection Cubemap', reflectionProbe._dynamicCubemap).setPosition(180, 10)
  gui.addTexture2D('Reflection OctMap', reflectionProbe._octMap)
  gui.addTexture2D('Reflection OctMapAtlas', reflectionProbe._reflectionMap)

  renderer.add(renderer.entity([
    renderer.transform({
      position: [5, 5, 5]
    }),
    dot
  ]))
  renderer.entity([ sun ])
  renderer.add(renderer.entity([ skybox ]))
  renderer.add(renderer.entity([ reflectionProbe ]))
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
