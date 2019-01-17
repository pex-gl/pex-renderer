const ctx = require('pex-context')()
const isBrowser = require('is-browser')
const load = require('pex-io/load')
const renderer = require('../../../pex-renderer')(ctx)

var ASSETS_DIR = isBrowser ? 'assets' : `${__dirname}/assets`

load({
  rainbow: { image: ASSETS_DIR + '/rainbow.jpg' },
  logo: { image: ASSETS_DIR + '/PEX.png' }
}, (err, res) => {
  if (err) console.log(err)

  renderer.add(renderer.entity([
    renderer.overlay({
      // enabled: false,
      texture: ctx.texture2D({
        data: res.rainbow,
        width: res.rainbow.width,
        height: res.rainbow.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true
      })
    })
  ]))

  renderer.add(renderer.entity([
    renderer.overlay({
      x: 100,
      y: 100,
      width: res.logo.width,
      height: res.logo.height,
      texture: ctx.texture2D({
        data: res.logo,
        width: res.logo.width,
        height: res.logo.height,
        pixelFormat: ctx.PixelFormat.RGBA8,
        encoding: ctx.Encoding.SRGB,
        flipY: true,
        premultiplayAlpha: true
      })
    })
  ]))

  ctx.frame(() => {
    renderer.draw()
  })
})
