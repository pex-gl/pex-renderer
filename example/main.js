var Window = require('pex-sys/Window')
var Mat4 = require('pex-math/Mat4')
var Vec3 = require('pex-math/Vec3')
var createSphere = require('primitive-sphere')
var PerspCamera = require('pex-cam/PerspCamera')
var Arcball = require('pex-cam/Arcball')
var Renderer = require('../Renderer')
var createSphere = require('primitive-sphere')
var createCube = require('primitive-cube')
var isBrowser = require('is-browser')
var GUI = require('../local_modules/pex-gui')
var random = require('pex-random')
var parseHdr = require('./local_modules/parse-hdr')
var cosineGradient = require('cosine-gradient')
var fitRect = require('fit-rect')
var patchGL = require('./patch-gl')
var ASSETS_DIR = isBrowser ? '/Assets' : '/Users/vorg/Downloads/Assets'

var scheme = [[0.000, 0.500, 0.500], [0.000, 0.500, 0.500], [0.000, 0.500, 0.333], [0.000, 0.500, 0.667]]

function randn_bm () {
  var u = 1 - Math.random() // Subtraction to flip [0, 1) to (0, 1].
  var v = 1 - Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function rand () {
  return (Math.random() * 2 - 1) * 3
}

var gradient = cosineGradient(scheme[0], scheme[1], scheme[2], scheme[3])

function canvasToPixels (canvas) {
  var pixels = []
  for (var y = canvas.height - 1; y >= 0; y--) {
    for (var x = 0; x < canvas.width; x++) {
      var i = (x + y * canvas.width) * 4
      // SkiaCanvas is BGRA
      pixels.push(canvas.pixels[i + 2], canvas.pixels[i + 1], canvas.pixels[i + 0], canvas.pixels[i + 3])
    }
  }
  return pixels
}

Window.create({
  settings: {
    type: '3d',
    width: 1280,
    height: 720,
    debug: true,
    fullScreen: isBrowser
  },
  resources: {
    envMap: { binary: ASSETS_DIR + '/textures/envmaps/garage/garage.hdr' }
    // envMap: { image: ASSETS_DIR + '/textures/envmaps/pisa/pisa_latlong_256.png' }
  },
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: 0,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  init: function () {
    try {
      var res = this.getResources()

      var gl = this.getContext().getGL()

      var APP_VERSION = 'app-30'

      var regl = this._regl = require('regl')({
        gl: patchGL(gl),
        extensions: [
          'WEBGL_depth_texture',
          'WEBGL_draw_buffers',
          'OES_texture_float',
          'OES_texture_float_linear',
          'OES_texture_half_float',
          'OES_texture_half_float_linear']
      })
      random.seed(10)

      var gui = this.gui = new GUI(regl, this.getWidth(), this.getHeight())
      this.addEventListener(gui)
      gui.addHeader(APP_VERSION)
      gui.addParam('Sun Elevation', this, 'elevation', { min: -90, max: 180 }, this.updateSunPosition.bind(this))

      var W = (this.getAspectRatio() > 1) ? 1280 : 720
      var H = (this.getAspectRatio() > 1) ? 720 : 1280
      var renderer = this.renderer = new Renderer(regl, W, H)

      this.viewport = [0, 0, 0, 0]
      this.updateViewport()

      this.camera = new PerspCamera(45, W / H, 0.1, 50.0)
      this.camera.lookAt([0, 3, 8], [0, 0, 0])
      var cameraNode = renderer.createNode({
        camera: this.camera
      })
      renderer.add(cameraNode)
      this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight())
      this.addEventListener(this.arcball)

      gui.addParam('Exposure', this.renderer._state, 'exposure', { min: 0.01, max: 5})
      // gui.addParam('Shadow Bias', this.renderer._state, 'bias', { min: 0.001, max: 0.1})
      gui.addParam('SSAO', this.renderer._state, 'ssao')
      gui.addParam('FXAA', this.renderer._state, 'fxaa')
      // gui.addParam('SSAO Sharpness', this.renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
      // gui.addParam('SSAO Radius', this.renderer._state, 'ssaoRadius', { min: 0, max: 1 })

      var envMapTex
      if (res.envMap) {
        if (res.envMap.width) {
          envMapTex = regl.texture({
            width: res.envMap.width,
            height: res.envMap.height,
            data: canvasToPixels(res.envMap)
          })
        } else { // binary
          var envMapInfo = parseHdr(res.envMap)
          envMapTex = regl.texture({
            shape: envMapInfo.shape,
            data: envMapInfo.data,
            type: 'float',
            min: 'linear',
            mag: 'linear'
          })
        }
        // gui.addTexture2D('EnvMap', envMapTex, { hdr: true })
        renderer._state.skyEnvMap = envMapTex
      }
      gui.addTexture2D('SkyEnvMap', renderer._skyEnvMapTex.getTexture(), { hdr: true })
      gui.addTextureCube('Reflection Map PREM', renderer._reflectionProbe.getReflectionMap(), { hdr: true })
      gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true })
      gui.addTexture2D('Color', renderer._frameColorTex, { hdr: true }).setPosition(180, 10)
      gui.addTexture2D('Normals', renderer._frameNormalTex)
      gui.addTexture2D('Depth', renderer._frameDepthTex)
      // gui.addTexture2D('Reflection OctMap', renderer._reflectionProbe._reflectionOctMap, { hdr: true })

      // gui.addTexture2D('Shadow Map', renderer._sunLightNode.data.light._shadowMap)

      // http://stackoverflow.com/a/36481059
      var mesh = createCube(0.2, 0.5 + Math.random(), 0.2)
      var i
      var x
      var y
      var z
      var s
      var cubes = []
      for (i = 0; i < 1000; i++) {
        x = randn_bm() * 8 / 3
        z = randn_bm() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        cubes.push({ position: [x, y, z], scale: [1, s, 1] })
      }
      renderer.add(renderer.createNode({
				mesh: mesh,
				position: [0, 0, 0],
				scale: [1, 1, 1],
				material: {
					baseColor: [0.9, 0.9, 0.9, 1.0],
					rougness: 0.7,
					metallic: 0.0
				},
				batch: cubes
			}))

      var sphereMesh = createSphere(0.2 + 0.5 * Math.random())
      var spheres = []
      for (i = 0; i < 100; i++) {
        x = rand() * 8 / 3
        z = rand() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        spheres.push({
          position: [x, y, z],
          scale: [s, s, s]
        })
      }
      renderer.add(renderer.createNode({
        mesh: sphereMesh,
        position: [0, 0, 0],
        scale: [1, 1, 1],
        material: {
          baseColor: gradient(0.4).concat(1), // FIXME: baseColor should go to batch
          rougness: 0.91,
          metallic: 1.0
        },
        batch: spheres
      }))
      var positions = []
      var p = [0, 0]
      for (i = 0; i < 100; i++) {
        var r = 2
        if (random.chance(0.5)) {
          p[0] += random.float(-r, r)
        } else {
          p[1] += random.float(-r, r)
        }
        positions.push([p[0], 0.2, p[1]])
      }
      renderer.add(renderer.createNode({
        mesh: { positions: positions },
        primitive: 'line strip',
        material: {
          baseColor: [0.9, 0.9, 0.2, 1],
          roughness: 1
        }
      }))

      renderer.add(renderer.createNode({
        mesh: createCube(0.2, 0.5 + Math.random(), 0.2),
        position: [2, 1, 0]
      }))

      var floorMesh = createCube(14, 0.02, 14)
      renderer.add(renderer.createNode({
        mesh: floorMesh,
        position: [0, -0.3, 0]
      }))

      this.updateSunPosition()
    } catch(e) {
      console.log(e)
      console.log(e.stack)
      if (typeof (process) !== 'undefined' && process.exit) {
        process.exit(-1)
      }
    }
  },
  onKeyPress: function (e) {
    if (e.str === 'g') this.gui.toggleEnabled()
  },
  onWindowResize: function (e) {
    this.updateViewport()
  },
  updateViewport: function () {
    var viewport = fitRect([0, 0, this.renderer._width, this.renderer._height], [0, 0, this.getWidth(), this.getHeight()], 'cover')
    this.viewport = [ viewport[0] | 0, viewport[1] | 0, viewport[2] | 0, viewport[3] | 0]
  },
  updateSunPosition: function () {
    Mat4.setRotation(this.elevationMat, this.elevation / 180 * Math.PI, [0, 0, 1])
    Mat4.setRotation(this.rotationMat, this.azimuth / 180 * Math.PI, [0, 1, 0])

    // TODO: set sun direction

    Vec3.set3(this.renderer._state.sunPosition, 1, 0, 0)
    Vec3.multMat4(this.renderer._state.sunPosition, this.elevationMat)
    Vec3.multMat4(this.renderer._state.sunPosition, this.rotationMat)
  },
  draw: function () {
    if (this.getTime().getElapsedFrames() % 300 === 0) {
      this.getContext().getGL().finish()
      console.time('App:frame')
      this.renderer._state.profile = true
    }

    if (this.getTime().getElapsedFrames() <= 1) {
      // this.renderer._cmdQueue.debug = true
    } else {
      // this.renderer._cmdQueue.debug = false
    }

    try {
      this.arcball.apply()
      this.renderer.draw(this.viewport)
    } catch(e) {
      console.log(e)
      console.log(e.stack)
      process.exit(-1)
    }

    if (this.getTime().getElapsedFrames() % 300 === 0) {
      this.renderer._state.profile = false
      // this.renderer._cmdQueue.profile = false
      console.timeEnd('App:frame')
      console.log('App:fps:', this.getTime().getFPS())
      console.log(this._regl.stats)
    }

    var sun = this.renderer._directionalLightNodes ? this.renderer._directionalLightNodes[0] : null
    if (sun && sun.data.light._shadowMap && !sun.guiElem) {
      // sun.guiElem = this.gui.addTexture2D('Sun shadow map', sun.data.light._shadowMap)
    }
    this.gui.draw()
    this._regl.poll()
  }
})
