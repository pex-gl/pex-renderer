const path = require('path')
const createRenderer = require('../..')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const ctx = createContext()
const renderer = createRenderer(ctx)

;(async () => {
  const rainbow = await io.loadImage(`${ASSETS_DIR}/rainbow.jpg`)
  const logo = await io.loadImage(`${ASSETS_DIR}/PEX.png`)

  const rainbowEntity = renderer.entity([
    renderer.overlay({
      texture: ctx.texture2D({
        data: rainbow,
        width: rainbow.width,
        height: rainbow.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true
      })
    })
  ])
  renderer.add(rainbowEntity)

  const logoEntity = renderer.entity([
    renderer.overlay({
      x: 100,
      y: 100,
      width: logo.width,
      height: logo.height,
      texture: ctx.texture2D({
        data: logo,
        width: logo.width,
        height: logo.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true,
        premultiplayAlpha: true
      })
    })
  ])
  renderer.add(logoEntity)
})()

ctx.frame(() => {
  renderer.draw()
})
