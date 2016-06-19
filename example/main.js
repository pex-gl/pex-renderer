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
var GUI = require('pex-gui')
var random = require('pex-random')
var parseHdr = require('./local_modules/parse-hdr')
var cosineGradient = require('cosine-gradient')

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

Window.create({
  settings: {
    type: '3d',
    width: 1280,
    height: 720,
    // debug: true,
    fullScreen: isBrowser
  },
  resources: {
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
      var ctx = this.getContext()
      var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight())
      this.addEventListener(gui)
      random.seed(10)

      gui.addParam('Sun Elevation', this, 'elevation', { min: -90, max: 180 }, this.updateSunPosition.bind(this))
      var renderer = this.renderer = new Renderer(ctx, this.getWidth(), this.getHeight())

      gui.addParam('Exposure', this.renderer._state, 'exposure', { min: 0.01, max: 5})
      gui.addParam('Shadow Bias', this.renderer._state, 'bias', { min: 0.001, max: 0.1})
      gui.addParam('SSAO', this.renderer._state, 'ssao')
      gui.addParam('SSAO Sharpness', this.renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
      gui.addParam('SSAO Radius', this.renderer._state, 'ssaoRadius', { min: 0, max: 1 })
      // this.renderer._state.debug = true

      var envMapTex
      if (res.envMap) {
        if (res.envMap.width) {
          envMapTex = ctx.createTexture2D(res.envMap)
        } else { // binary
          var envMapInfo = parseHdr(res.envMap)
          envMapTex = ctx.createTexture2D(envMapInfo.data, envMapInfo.shape[0], envMapInfo.shape[1], {
            type: ctx.FLOAT
          })
        }
        gui.addTexture2D('EnvMap', envMapTex, { hdr: true })
        renderer._state.skyEnvMap = envMapTex
      }
      gui.addTexture2D('SkyEnvMap', renderer._skyEnvMapTex, { hdr: true })
      gui.addTextureCube('Reflection Map', renderer._reflectionProbe.getReflectionMap(), { hdr: true })
      gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true })
      // gui.addTexture2D('Reflection OctMap', renderer._reflectionProbe._reflectionOctMap, { hdr: true })

      this.camera = new PerspCamera(45, this.getAspectRatio(), 0.1, 50.0)
      this.camera.lookAt([0, 3, 8], [0, 0, 0])
      renderer.createNode({
        camera: this.camera
      })

      this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight())
      this.addEventListener(this.arcball)

      // var sunDir = Vec3.normalize([1, 0.1, 0])
      // this.sunLightNode = renderer.createNode({
      // light: {
      // type: 'directional',
      // direction: sunDir
      // }
      // })
      // gui.addTexture2D('Shadow Map', this.sunLightNode.light._shadowMap)

      // http://stackoverflow.com/a/36481059
      var mesh = this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2))
      // var mesh = this.buildMesh(createSphere(0.2 + Math.random() * 0.3))
      var i
      var x
      var y
      var z
      var s
      for (i = 0; i < 1000; i++) {
        x = randn_bm() * 8 / 3
        z = randn_bm() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        renderer.createNode({
          mesh: mesh,
          position: [x, y, z],
          scale: [1, s, 1],
          material: {
            albedoColor: [0.9, 0.9, 0.9, 1.0],
            rougness: 0.7,
            metallic: 0.0
          }
        })
      }

      var sphereMesh = this.buildMesh(createSphere(0.2 + Math.random()))
      for (i = 0; i < 100; i++) {
        x = rand() * 8 / 3
        z = rand() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        renderer.createNode({
          mesh: sphereMesh,
          position: [x, y, z],
          scale: [s, s, s],
          material: {
            baseColor: gradient(Math.random()).concat(1),
            rougness: 0.91,
            metallic: 1.0
          }
        })
      }
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
      renderer.createNode({
        mesh: this.buildMesh({ positions: positions }, ctx.LINE_STRIP),
        material: {
          baseColor: [0.9, 0.9, 0.2, 1],
          roughness: 1
        }
      })

      renderer.createNode({
        mesh: this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)),
        position: [2, 1, 0]
      })

      ctx.setLineWidth(5)

      var floorMesh = this.buildMesh(createCube(14, 0.02, 14))
      renderer.createNode({
        mesh: floorMesh,
        position: [0, -0.3, 0]
      })

      this.updateSunPosition()
    } catch(e) {
      console.log(e)
      console.log(e.stack)
      process.exit(-1)
    }
  },
  onKeyPress: function (e) {
    if (e.str === 'g') this.gui.toggleEnabled()
  },
  updateSunPosition: function () {
    Mat4.setRotation(this.elevationMat, this.elevation / 180 * Math.PI, [0, 0, 1])
    Mat4.setRotation(this.rotationMat, this.azimuth / 180 * Math.PI, [0, 1, 0])

    // TODO: set sun direction

    Vec3.set3(this.renderer._state.sunPosition, 1, 0, 0)
    Vec3.multMat4(this.renderer._state.sunPosition, this.elevationMat)
    Vec3.multMat4(this.renderer._state.sunPosition, this.rotationMat)
  },
  buildMesh: function (geometry, primitiveType) {
    var ctx = this.getContext()
    var attributes = [
      { data: geometry.positions, location: ctx.ATTRIB_POSITION },
      { data: geometry.uvs || geometry.positions, location: ctx.ATTRIB_TEX_COORD_0 },
      { data: geometry.normals || geometry.positions, location: ctx.ATTRIB_NORMAL }
    ]
    var indices = { data: geometry.cells }
    return ctx.createMesh(attributes, geometry.cells ? indices : null, primitiveType)
  },
  draw: function () {
    if (this.getTime().getElapsedFrames() % 30 === 0) {
      this.getContext().getGL().finish()
      console.time('frame')
      this.renderer._state.profile = true
    }
    try {
      this.arcball.apply()
      this.renderer.draw()

      var ctx = this.getContext()
      ctx.pushState(ctx.ALL_BIT)
      this.gui.draw()
      ctx.popState()
    } catch(e) {
      console.log(e)
      console.log(e.stack)
      process.exit(-1)
    }
    if (this.getTime().getElapsedFrames() % 30 === 0) {
      this.renderer._state.profile = false
      this.getContext().getGL().finish()
      console.timeEnd('frame')
      console.log('fps:', this.getTime().getFPS())
    }
  }
})
