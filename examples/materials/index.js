const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createRenderer = require('../../')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const gridCells = require('grid-cells')
const parseHdr = require('./local_modules/parse-hdr')
dragon.positions = centerAndNormalize(dragon.positions).map((v) => Vec3.scale(v, 5))
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const HOST = isBrowser ? document.location.hostname : ''
const ASSETS_DIR = isBrowser ? `http://${HOST}/assets` : '/Users/vorg/Workspace/assets'
const TEX_DIR = isBrowser ? `http://${HOST}/assets/textures/gametextures_old_met_selected` : '/Users/vorg/Workspace/assets/textures/gametextures_old_met_selected'

window.addEventListener('keydown', (e) => {
  if (e.key == 'g') gui.toggleEnabled()
})

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: true
}

random.seed(10)

const renderer = createRenderer({
  pauseOnBlur: true,
  ctx: ctx,
  // profile: true,
  rgbm: State.rgbm,
  shadowQuality: 2,
  exposure: 1.5
})

const gui = createGUI(ctx)
gui.setEnabled(false)
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)
gui.addParam('Exposure', renderer._state, 'exposure', { min: 0, max: 5 })

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(State.sunPosition, 10, 0, 0)
  Vec3.multMat4(State.sunPosition, State.elevationMat)
  Vec3.multMat4(State.sunPosition, State.rotationMat)

  if (State.sun) {
    var sunDir = State.sun.direction
    Vec3.set(sunDir, [0, 0, 0])
    Vec3.sub(sunDir, State.sunPosition)
    State.sun.set({ direction: sunDir })
  }

  if (State.skybox) {
    State.skybox.set({ sunPosition: State.sunPosition })
  }

  if (State.reflectionProbe) {
    State.reflectionProbe.dirty = true // FIXME: hack
  }
}

// gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 3
const nH = 2

// flip upside down as we are using viewport coordinates
let cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: (W / nW) / (H / nH),
    position: [0, 0, 1.6],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  cells.forEach((cell, cellIndex) => {
    const tags = ['cell' + cellIndex]
    const cameraCmp = renderer.camera({
      camera: camera,
      viewport: cell,
    })
    renderer.entity([
      cameraCmp
    ], null, tags)
  })
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
    // tex(Object.assign(canvasToPixels(image), {
      // min: 'mipmap',
      // mag: 'linear',
      // wrap: 'repeat'
    // }))
  }, true)
  return tex
}

function initMeshes () {
  // const geom = createRoundedCube(1, 1, 1, 20, 20, 20, 0.2)
  // const geom = createCapsule(0.3)
  const geom = createSphere(0.5)

  let materials = [
    { roughness: 0 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 1 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 2 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 3 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 4 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 5 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 6 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 7 / 7, metallic: 0, baseColor: [0.8, 0.2, 0.2, 1.0] },
    { roughness: 0 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 1 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 2 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 3 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 4 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 5 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 6 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    { roughness: 7 / 7, metallic: 1, baseColor: [1.0, 1.0, 1.0, 1.0] },
    {
      baseColorMap: TEX_DIR + '/Metal_ScifiTrimPieces_Base_Color.png',
      roughnessMap: TEX_DIR + '/Metal_ScifiTrimPieces_Roughness.png',
      metallicMap: TEX_DIR + '/Metal_ScifiTrimPieces_Metallic.png',
      normalMap: TEX_DIR + '/Metal_ScifiTrimPieces_Normal.png',
      emissiveColorMap: TEX_DIR + '/SciFi_Emissive.png'
    },
    {
      baseColorMap: TEX_DIR + '/Metal_SciFiDetailKit_Base_Color.png',
      roughnessMap: TEX_DIR + '/Metal_SciFiDetailKit_Roughness.png',
      metallicMap: TEX_DIR + '/Metal_SciFiDetailKit_Metallic.png',
      normalMap: TEX_DIR + '/Metal_SciFiDetailKit_Normal.png',
      emissiveColorMap: TEX_DIR + '/SciFi_Emissive.png',
    },
    {
      baseColorMap: TEX_DIR + '/Misc_PaintedBarrel_Base_Color.png',
      roughnessMap: TEX_DIR + '/Misc_PaintedBarrel_Roughness.png',
      metallicMap: TEX_DIR + '/Misc_PaintedBarrel_Metallic.png',
      normalMap: TEX_DIR + '/Misc_PaintedBarrel_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Wood_AlternatingSquareTiles_Base_Color_2.png',
      roughnessMap: TEX_DIR + '/Wood_AlternatingSquareTiles_Roughness.png',
      metallicMap: TEX_DIR + '/Wood_AlternatingSquareTiles_Metallic.png',
      normalMap: TEX_DIR + '/Wood_AlternatingSquareTiles_Normal.png',
      emissiveColorMap: TEX_DIR + '/SciFi_Emissive.png'
    },
    {
      baseColorMap: TEX_DIR + '/Metal_Gold_Base_Color.png',
      roughnessMap: TEX_DIR + '/Metal_Gold_Roughness.png',
      metallicMap: TEX_DIR + '/Metal_Gold_Metallic.png',
      normalMap: TEX_DIR + '/Metal_Gold_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Metal_ChromeScratched_Base_Color.png',
      roughnessMap: TEX_DIR + '/Metal_ChromeScratched_Roughness.png',
      metallicMap: TEX_DIR + '/Metal_ChromeScratched_Metallic.png',
      normalMap: TEX_DIR + '/Metal_ChromeScratched_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Metal_AluminiumDirectional_Base_Color.png',
      roughnessMap: TEX_DIR + '/Metal_AluminiumDirectional_Roughness.png',
      metallicMap: TEX_DIR + '/Metal_AluminiumDirectional_Metallic.png',
      normalMap: TEX_DIR + '/Metal_AluminiumDirectional_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Tile_Disgusting_Base_Color.png',
      roughnessMap: TEX_DIR + '/Tile_Disgusting_Roughness.png',
      metallicMap: TEX_DIR + '/Tile_Disgusting_Metallic.png',
      normalMap: TEX_DIR + '/Tile_Disgusting_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Tile_CurveSandTiles_Base_Color.png',
      roughnessMap: TEX_DIR + '/Tile_CurveSandTiles_Roughness.png',
      metallicMap: TEX_DIR + '/Tile_CurveSandTiles_Metallic.png',
      normalMap: TEX_DIR + '/Tile_CurveSandTiles_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Concrete_EpoxyPaintedFloor_Base_Color.png',
      roughnessMap: TEX_DIR + '/Concrete_EpoxyPaintedFloor_Roughness.png',
      metallicMap: TEX_DIR + '/Concrete_EpoxyPaintedFloor_Metallic.png',
      normalMap: TEX_DIR + '/Concrete_EpoxyPaintedFloor_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/COBBLESTONE-02-Demo/COBBLESTONE-02_Demo_Color_4k.jpg',
      roughnessMap: TEX_DIR + '/COBBLESTONE-02-Demo/COBBLESTONE-02_Demo_Roughness_4k.jpg',
      metallic: 0,
      normalMap: TEX_DIR + '/COBBLESTONE-02-Demo/COBBLESTONE-02_Demo_Normal_4k.jpg'
    },
    {
      baseColorMap: TEX_DIR + '/iSourceTextures - Metal07_ALBEDO.png',
      roughnessMap: TEX_DIR + '/iSourceTextures - Metal07_SPEC.png',
      metallicMap: TEX_DIR + '/iSourceTextures - Metal07_METTALIC.png',
      normalMap: TEX_DIR + '/iSourceTextures - Metal07_NORM.png'
    },
    {
      baseColorMap: TEX_DIR + '/Plastic_Base_Color.png',
      roughnessMap: TEX_DIR + '/Plastic_Roughness.png',
      metallicMap: TEX_DIR + '/Plastic_Metalness.png',
      normalMap: TEX_DIR + '/Plastic_Normal.png'
    },
    {
      baseColorMap: TEX_DIR + '/Plastic_Base_Color_2.png',
      roughnessMap: TEX_DIR + '/Plastic_Roughness_2.png',
      metallicMap: TEX_DIR + '/Plastic_Metalness_2.png',
      normalMap: TEX_DIR + '/Plastic_Normal_2.png'
    },
    { roughness: 2 / 7, metallic: 0, baseColor: [0.1, 0.5, 0.8, 1.0] },
    { roughness: 3 / 7, metallic: 0, baseColor: [0.1, 0.1, 0.1, 1.0] },
  ]

  // materials = materials.slice(0, materials.length / 2 | 0 + 4)
  materials = materials.filter((m, i) => i % 6 == 0)

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
    const components = [
      renderer.geometry(geom),
      renderer.material({
        baseColor: material ? material.baseColor : [1, 1, 1, 1],
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
    const entity = renderer.entity(components, null, tags)
  })
    }

    function initSky (panorama) {
      const sun = State.sun = renderer.directionalLight({
        direction: Vec3.sub(Vec3.create(), State.sunPosition),
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

      renderer.entity([
        renderer.transform({
          position: [5, 5, 5]
        }),
        dot
      ])
      // renderer.entity([ sun ])
      renderer.entity([ skybox ])
      renderer.entity([ reflectionProbe ])
    }

    initCamera()
    initMeshes()
    // initSky()

    // io.loadBinary(ASSETS_DIR + '/envmaps/pisa/pisa.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/Hamarikyu_Bridge/Hamarikyu_Bridge.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/multi-area-light/multi-area-light.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/hallstatt4_hd.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/uprat5_hd.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/OpenfootageNETHDRforrest03_small.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/OpenfootageNET_Salzach_low.hdr', (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/OpenfootageNET_Staatsbridge_HDRI_low.hdr', (err, buf) => {
    io.loadBinary(`http://${HOST}/assets/envmaps/garage/garage.hdr`, (err, buf) => {
    // io.loadBinary('http://192.168.1.123/assets/envmaps/grace-new/grace-new.hdr', (err, buf) => {
      const hdrImg = parseHdr(buf)
      const data = new Uint8Array(hdrImg.data.length)
      // const data = new Float32Array(hdrImg.data.length)
      // for (var i = 0; i < hdrImg.data.length; i++) {
      // hdrImg.data[i] = Math.min(1, hdrImg.data[i])
      // }
      // r.xyz = (1.0 / 7.0) * sqrt(rgb);
      // r.a = max(max(r.x, r.y), r.z);
      // r.a = clamp(r.a, 1.0 / 255.0, 1.0);
      // r.a = ceil(r.a * 255.0) / 255.0;
      // r.xyz /= r.a;
      var D = 7
      for (var i = 0; i < hdrImg.data.length; i+=4) {
        let r = hdrImg.data[i]
        let g = hdrImg.data[i + 1]
        let b = hdrImg.data[i + 2]
        r = 1 / D * Math.sqrt(r)
        g = 1 / D * Math.sqrt(g)
        b = 1 / D * Math.sqrt(b)
        let a = Math.max(r, Math.max(g, b))
        if (a > 1) a = 1
        if (a < 1 / 255) a = 1 / 255
        a = Math.ceil(a * 255) / 255
        r /= a
        g /= a
        b /= a
        data[i] = (r * 255) | 0
        data[i + 1] = (g * 255) | 0
        data[i + 2] = (b * 255) | 0
        data[i + 3] = (a * 255) | 0
      }
      console.log('data', data, hdrImg)
      for (var i = 0; i < hdrImg.data.length; i+=4) {
        // hdrImg.data[i] = data[i] / 255 * D * data[i + 3] / 255
        // hdrImg.data[i + 1] = data[i + 1] / 255 * D * data[i + 3] / 255
        // hdrImg.data[i + 2] = data[i + 2] / 255 * D * data[i + 3] / 255
        // hdrImg.data[i] *= hdrImg.data[i]
        // hdrImg.data[i + 1] *= hdrImg.data[i + 1]
        // hdrImg.data[i + 2] *= hdrImg.data[i + 2]
      }
      const panoramaRGBM = ctx.texture2D({
        data: State.rgbm ? data : hdrImg.data,
        width: hdrImg.shape[0],
        height: hdrImg.shape[1], 
        pixelFormat: State.rgbm ? ctx.PixelFormat.RGBA8 : ctx.PixelFormat.RGBA32F,
        encoding: State.rgbm ? ctx.Encoding.RGBM : ctx.Encoding.Linear,
        flipY: true
      })
      gui.addTexture2D('Panorama', panoramaRGBM)
      initSky(panoramaRGBM)
    })

    let frameNumber = 0
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
