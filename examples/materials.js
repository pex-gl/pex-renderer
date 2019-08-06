const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const random = require('pex-random')
const io = require('pex-io')
const createSphere = require('primitive-sphere')
const isBrowser = require('is-browser')
const gridCells = require('grid-cells')
const parseHdr = require('parse-hdr')

const State = {
  sunPosition: [0, 5, -5],
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  rgbm: false,
  exposure: 1
}

random.seed(10)

const ctx = createContext({
  powerPreference: 'high-performance'
})
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')
ctx.gl.getExtension('EXT_texture_filter_anisotropic')

const renderer = createRenderer({
  ctx,
  pauseOnBlur: true,
  rgbm: State.rgbm,
  shadowQuality: 2
})

const gui = createGUI(ctx)
gui.setEnabled(false)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')
const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 8
const nH = 3
let debugOnce = false

// Materials
let materials = [
  {
    baseColor: [1.0, 1.0, 1.0, 1.0],
    metallic: 0,
    roughness: 1,
    baseColorMap: ASSETS_DIR + '/uv-wide.png'
  },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 0 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 1 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 2 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 3 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 4 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 5 / 6 },
  { baseColor: [0.8, 0.2, 0.2, 1.0], metallic: 0, roughness: 6 / 6 },
  {
    baseColor: [1.0, 1.0, 0.9, 1.0],
    metallic: 1,
    roughness: 1,
    roughnessMap: ASSETS_DIR + '/roughness-test.png'
  },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 0 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 1 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 2 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 3 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 4 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 5 / 6 },
  { baseColor: [1.0, 1.0, 1.0, 1.0], metallic: 1, roughness: 6 / 6 },
  {
    unlit: true,
    baseColor: [1, 1, 1, 0.5],
    baseColorMap:
      ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png'
  },
  {
    baseColorMap:
      ASSETS_DIR + '/plastic-green.material/plastic-green_basecolor.png',
    roughnessMap:
      ASSETS_DIR + '/plastic-green.material/plastic-green_roughness.png',
    metallicMap:
      ASSETS_DIR + '/plastic-green.material/plastic-green_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-green.material/plastic-green_n.png'
  },
  {
    baseColorMap:
      ASSETS_DIR + '/plastic-red.material/plastic-red_basecolor.png',
    roughnessMap:
      ASSETS_DIR + '/plastic-red.material/plastic-red_roughness.png',
    metallicMap: ASSETS_DIR + '/plastic-red.material/plastic-red_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-red.material/plastic-red_n.png'
  },
  {
    baseColorMap:
      ASSETS_DIR + '/plastic-glow.material/plastic-glow_basecolor.png',
    roughnessMap:
      ASSETS_DIR + '/plastic-glow.material/plastic-glow_roughness.png',
    metallicMap:
      ASSETS_DIR + '/plastic-glow.material/plastic-glow_metallic.png',
    normalMap: ASSETS_DIR + '/plastic-glow.material/plastic-glow_n.png',
    emissiveColor: [1, 1, 1, 1],
    emissiveColorMap:
      ASSETS_DIR + '/plastic-glow.material/plastic-glow_emissive.png',
    emissiveIntensity: 4
  },
  { roughness: 2 / 7, metallic: 0, baseColor: [0.1, 0.5, 0.8, 1.0] },
  { roughness: 3 / 7, metallic: 0, baseColor: [0.1, 0.1, 0.1, 1.0] },
  {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 0.5],
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One
  },
  {
    roughness: 0.5,
    metallic: 0,
    baseColor: [1, 1, 1, 1],
    alphaTest: 0.5,
    cullFace: false,
    baseColorMap: ASSETS_DIR + '/alpha-test-mask.png',
    alphaMap: ASSETS_DIR + '/checkerboard.png'
  }
]

// Utils
let cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  // flip upside down as we are using viewport coordinates
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

cells.forEach((cell, cellIndex) => {
  const tags = ['cell' + cellIndex]
  const material = materials[cellIndex]
  const cameraCmp = renderer.camera({
    fov: Math.PI / 3,
    aspect: W / nW / (H / nH),
    viewport: cell,
    exposure: State.exposure
  })
  const postProcessingCmp = renderer.postProcessing({
    fxaa: true
  })

  if (material.emissiveColor) {
    postProcessingCmp.set({
      bloom: true,
      bloomIntensity: 0.5,
      bloomThreshold: 3,
      bloomRadius: 1.25
    })
  }

  const cameraEntity = renderer.entity(
    [
      postProcessingCmp,
      cameraCmp,
      renderer.orbiter({
        position: [0, 0, 1.9]
      })
    ],
    tags
  )
  renderer.add(cameraEntity)

  gui.addTexture2D('Depth Map', postProcessingCmp._frameDepthTex)
  gui.addTexture2D('Normal Map', postProcessingCmp._frameNormalTex)
})
gui.addParam('Exposure', State, 'exposure', { min: 0.01, max: 5 }, () => {
  renderer.getComponents('Camera').forEach((camera) => {
    camera.set({ exposure: State.exposure })
  })
})

function imageFromFile(file) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.SRGB
  })
  io.loadImage(
    file,
    function(err, image, encoding) {
      if (err) throw err
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
    },
    true
  )
  return tex
}

// Meshes
materials.forEach((material) => {
  if (material.baseColorMap)
    material.baseColorMap = imageFromFile(
      material.baseColorMap,
      ctx.Encoding.SRGB
    )
  if (material.roughnessMap)
    material.roughnessMap = imageFromFile(
      material.roughnessMap,
      ctx.Encoding.Linear
    )
  if (material.metallicMap)
    material.metallicMap = imageFromFile(
      material.metallicMap,
      ctx.Encoding.Linear
    )
  if (material.normalMap)
    material.normalMap = imageFromFile(material.normalMap, ctx.Encoding.Linear)
  if (material.alphaMap)
    material.alphaMap = imageFromFile(material.alphaMap, ctx.Encoding.Linear)
  if (material.emissiveColorMap)
    material.emissiveColorMap = imageFromFile(
      material.emissiveColorMap,
      ctx.Encoding.SRGB
    )
  material.castShadows = true
  material.receiveShadows = true
})

cells.forEach((cell, cellIndex) => {
  const tags = ['cell' + cellIndex]
  const material = materials[cellIndex]
  if (!material) return

  const materialEntity = renderer.entity(
    [renderer.geometry(createSphere(0.5)), renderer.material(material)],
    tags
  )
  renderer.add(materialEntity)
})

// Sky
;(async () => {
  const buffer = await io.loadBinary(`${ASSETS_DIR}/garage.hdr`)
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })

  const sun = renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2,
    castShadows: true
  })
  const sunEntity = renderer.entity([
    renderer.transform({
      position: [2, 2, 2],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([-2, -2, -2])
      )
    }),
    sun
  ])
  renderer.add(sunEntity)
  gui.addTexture2D('ShadowMap', sun._shadowMap)

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

  gui.addTexture2D('Panorama', panorama)
  gui
    .addTextureCube('Reflection Cubemap', reflectionProbe._dynamicCubemap)
    .setPosition(180, 10)
  gui.addTexture2D('Reflection OctMap', reflectionProbe._octMap)
  gui.addTexture2D('Reflection OctMapAtlas', reflectionProbe._reflectionMap)

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})()

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') gui.toggleEnabled()
  if (e.key === 'd') debugOnce = true
})

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
