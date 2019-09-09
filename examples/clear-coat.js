const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const io = require('pex-io')
const { quat, vec3 } = require('pex-math')
const GUI = require('pex-gui')
const parseHdr = require('parse-hdr')
const parseObj = require('geom-parse-obj')
const isBrowser = require('is-browser')
const { loadText } = require('pex-io')

const State = {
  rotation: 1.5 * Math.PI
}

const ctx = createContext()
const renderer = createRenderer(ctx)
const gui = new GUI(ctx)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

for (var i = 0; i < 3; i++) {
  const camera = renderer.entity(
    [
      renderer.transform({ position: [0, 0, 3] }),
      renderer.camera({
        fov: Math.PI / 3,
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
        near: 0.1,
        far: 100,
        postprocess: false,
        viewport: [
          i * Math.floor((1 / 3) * window.innerWidth),
          0,
          Math.floor((1 / 3) * window.innerWidth),
          window.innerHeight
        ]
      }),
      renderer.orbiter({
        position: [0.5, 0.5, 2]
      }),
      renderer.postProcessing({
        fxaa: true,
        ssao: true,
        ssaoStrength: 5
      })
    ],
    ['camera-' + (i + 1)]
  )
  renderer.add(camera)
}

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

function getMaterialMaps(maps) {
  return Object.entries(maps).reduce(
    (currentValue, [key, image]) => ({
      ...currentValue,
      [key]: ctx.texture2D({
        data: image,
        width: 256,
        height: 256,
        min: ctx.Filter.LinearMipmapLinear,
        mag: ctx.Filter.Linear,
        wrap: ctx.Wrap.Repeat,
        flipY: true,
        mipmap: true,
        encoding:
          key === 'emissiveColorMap' || key === 'baseColorMap'
            ? ctx.Encoding.SRGB
            : ctx.Encoding.Linear
      })
    }),
    {}
  )
}

const directionalLight = renderer.entity([
  renderer.transform({
    rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([1, -3, -1]))
  }),
  renderer.directionalLight({
    castShadows: true,
    color: [1, 1, 1, 1]
  })
])
renderer.add(directionalLight)

const reflectionProbe = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbe)
;(async () => {
  const buffer = await io.loadBinary(
    `${ASSETS_DIR}/envmaps/Road_to_MonumentValley/Road_to_MonumentValley.hdr`
  )
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })

  skybox.getComponent('Skybox').set({ texture: panorama })
  reflectionProbe.getComponent('ReflectionProbe').set({ dirty: true })

  const materialMaps = getMaterialMaps({
    baseColorMap: await io.loadImage(
      `${ASSETS_DIR}/materials/Fabric04/Fabric04_col.jpg`
    ),
    normalMap: await io.loadImage(
      `${ASSETS_DIR}/materials/Fabric04/Fabric04_nrm.jpg`
    ),
    clearCoatNormalMap: await io.loadImage(
      `${ASSETS_DIR}/materials/Metal05/Metal05_nrm.jpg`
    ),
    aoMap: await io.loadImage(
      `${ASSETS_DIR}/models/substance-sample-scene/substance-sample-scene_ao.jpg`
    )
  })

  const materialGeom = parseObj(
    await loadText(
      `${ASSETS_DIR}/models/substance-sample-scene/substance-sample-scene.obj`
    )
  )

  const geom1 = renderer.entity(
    [
      renderer.transform({ position: [0, 0, 0] }),
      renderer.geometry(materialGeom),
      renderer.material({
        baseColor: [1, 0, 0, 1],
        roughness: 0.25,
        metallic: 0,
        clearCoat: 1,
        clearCoatRoughness: 0.1,
        castShadows: true,
        receiveShadows: true,
        occlusionMap: {
          texture: materialMaps.aoMap,
          scale: [1, 1]
        }
      })
    ],
    ['camera-1']
  )
  renderer.add(geom1)

  const geom2 = renderer.entity(
    [
      renderer.transform({ position: [0, 0, 0] }),
      renderer.geometry(materialGeom),
      renderer.material({
        baseColor: [1, 0, 0, 1],
        roughness: 0.25,
        metallic: 0,
        clearCoat: 1,
        clearCoatRoughness: 0.1,
        castShadows: true,
        receiveShadows: true,
        normalMap: {
          texture: materialMaps.normalMap,
          scale: [4, 4]
        },
        occlusionMap: {
          texture: materialMaps.aoMap,
          scale: [1, 1]
        }
      })
    ],
    ['camera-2']
  )
  renderer.add(geom2)

  const geom3 = renderer.entity(
    [
      renderer.transform({ position: [0, 0, 0] }),
      renderer.geometry(materialGeom),
      renderer.material({
        baseColor: [1, 0, 0, 1],
        roughness: 0.25,
        metallic: 0,
        clearCoat: 1,
        clearCoatRoughness: 0.1,
        castShadows: true,
        receiveShadows: true,
        normalMap: {
          texture: materialMaps.normalMap,
          scale: [4, 4]
        },
        clearCoatNormalMap: {
          texture: materialMaps.clearCoatNormalMap,
          scale: [8, 8]
        },
        occlusionMap: {
          texture: materialMaps.aoMap,
          scale: [1, 1]
        }
      })
    ],
    ['camera-3']
  )
  renderer.add(geom3)

  const skyboxCmp = skybox.getComponent('Skybox')
  const materialCmp = geom1.getComponent('Material')
  const reflectionProbeCmp = reflectionProbe.getComponent('ReflectionProbe')
  gui.addHeader('Settings')
  gui.addParam('Environment', reflectionProbeCmp, 'enabled', {}, (value) => {
    skyboxCmp.set({ enabled: value })
  })
  gui.addParam('BG Blur', skyboxCmp, 'backgroundBlur', {}, () => {})
  gui.addParam('ClearCoat', materialCmp, 'clearCoat', {}, () => {
    geom1.getComponent('Material').set({ clearCoat: materialCmp.clearCoat })
    geom2.getComponent('Material').set({ clearCoat: materialCmp.clearCoat })
    geom3.getComponent('Material').set({ clearCoat: materialCmp.clearCoat })
  })
  gui.addParam(
    'ClearCoat Roughness',
    materialCmp,
    'clearCoatRoughness',
    {},
    () => {
      geom1
        .getComponent('Material')
        .set({ clearCoatRoughness: materialCmp.clearCoatRoughness })
      geom2
        .getComponent('Material')
        .set({ clearCoatRoughness: materialCmp.clearCoatRoughness })
      geom3
        .getComponent('Material')
        .set({ clearCoatRoughness: materialCmp.clearCoatRoughness })
    }
  )

  ctx.frame(() => {
    renderer.draw()
    gui.draw()
    window.dispatchEvent(new CustomEvent('pex-screenshot'))
  })
})()
