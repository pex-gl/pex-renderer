const path = require('path')
const createRenderer = require('../')
const createContext = require('pex-context')
const io = require('pex-io')
const { quat } = require('pex-math')
const GUI = require('pex-gui')
const createSphere = require('primitive-sphere')
const parseHdr = require('parse-hdr')
const isBrowser = require('is-browser')

const State = {
  rotation: 1.5 * Math.PI
}

const ctx = createContext()
const renderer = createRenderer(ctx)
const gui = new GUI(ctx)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    postprocess: false
  }),
  renderer.orbiter({
    position: [0, 0, 3]
  })
])
renderer.add(camera)

const geom = renderer.entity([
  renderer.transform({ position: [0, 0, 0] }),
  renderer.geometry(createSphere(1)),
  renderer.material({
    baseColor: [1, 1, 1, 1],
    roughness: 0,
    metallic: 1
  })
])
renderer.add(geom)

const skybox = renderer.entity([
  renderer.transform({
    rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation)
  }),
  renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 0
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbe)

;(async () => {
  const buffer = await io.loadBinary(`${ASSETS_DIR}/Mono_Lake_B.hdr`)
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

  const skyboxCmp = skybox.getComponent('Skybox')
  const materialCmp = geom.getComponent('Material')
  const cameraCmp = camera.getComponent('Camera')
  gui.addHeader('Settings')
  gui.addParam('Enabled', skyboxCmp, 'enabled', {}, (value) => {
    skyboxCmp.set({ enabled: value })
  })
  gui.addParam('Rotation', State, 'rotation', { min: 0, max: 2 * Math.PI }, () => {
    skybox.getComponent('Transform').set({
      rotation: quat.fromAxisAngle(quat.create(), [0, 1, 0], State.rotation)
    })
    reflectionProbe.getComponent('ReflectionProbe').set({ dirty: true })
  })
  gui.addParam('BG Blur', skyboxCmp, 'backgroundBlur', {}, () => { })
  gui.addParam('Exposure', cameraCmp, 'exposure', { min: 0, max: 2 }, () => { })
  gui.addParam('Roughness', materialCmp, 'roughness', {}, () => { })
  gui.addTexture2D('Reflection Probe', reflectionProbe.getComponent('ReflectionProbe')._reflectionMap)

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})()

ctx.frame(() => {
  renderer.draw()
  gui.draw()
})
