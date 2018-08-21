const createContext = require('pex-context')
const createRenderer = require('../..')
const createSphere = require('primitive-sphere')
const parseHdr = require('parse-hdr')
const loadBinary = require('pex-io').loadBinary
const loadImage = require('pex-io').loadImage
const GUI = require('pex-gui')

const ctx = createContext({})

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
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

loadBinary(`assets/Mono_Lake_B.hdr`, (err, buf) => {
  if (err) console.log('Loading HDR file failed', err)
  const hdrImg = parseHdr(buf)
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
  skybox.getComponent('Skybox').set({ texture: panorama })
  skybox.getComponent('Skybox').set({ reflectionProbe: reflectionProbe.getComponent('ReflectionProbe') })
})

var skyboxCmp = skybox.getComponent('Skybox')
var gui = new GUI(ctx)
gui.addHeader('Settings')
gui.addParam('BG Blur', skyboxCmp, 'backgroundBlur', {}, () => {
})

ctx.frame(() => {
  renderer.draw()
  gui.draw()
})
