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
// var GUI = require('pex-gui')
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
    debug: false,
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
      // var gui = this.gui = new GUI(ctx, this.getWidth(), this.getHeight())
      // this.addEventListener(gui)

      var gl = ctx.getGL()

      function getEnumName (e) {
        for (var name in gl) {
          if (gl[name] === e) return name
        }
        return 'UNDEFINED-' + e
      }

      if (!gl.getContextAttributes) {
        gl.getSupportedExtensions = function () {
          return 'EXT_blend_minmax,EXT_sRGB,EXT_frag_depth,\
          OES_texture_float,OES_texture_float_linear,\
          OES_texture_half_float,OES_texture_half_float_linear,\
          OES_standard_derivatives,EXT_shader_texture_lod,\
          EXT_texture_filter_anisotropic,OES_vertex_array_object,\
          OES_element_index_uint,WEBGL_lose_context,WEBGL_compressed_texture_s3tc,\
          WEBGL_depth_texture,WEBGL_draw_buffers,ANGLE_instanced_arrays,\
          WEBGL_debug_renderer_info'.toLowerCase().split(',')
        }
        gl.getExtension = function (name) {
          if (name === 'oes_texture_float') return {}
          if (name === 'oes_texture_float_linear') return {}
          if (name === 'oes_texture_half_float') return {}
          if (name === 'oes_texture_half_float_linear') return {}
          if (name === 'webgl_depth_texture') return {}
          if (name === 'webgl_draw_buffers') {
            return {
              drawBuffersWEBGL: gl.drawBuffers.bind(gl)
            }
          }
        }

        var GL_COMPRESSED_TEXTURE_FORMATS = 0x86A3
        var glGetParameter = gl.getParameter
        gl.getParameter = function (name) {
          if (name === GL_COMPRESSED_TEXTURE_FORMATS) return []
          if (name === gl.MAX_TEXTURE_SIZE) return 16384
          if (name === gl.MAX_CUBE_MAP_TEXTURE_SIZE) return 16384
          if (name === gl.MAX_DRAW_BUFFERS) return 4
          if (name === gl.RED_BITS) return 8
          if (name === gl.GREEN_BITS) return 8
          if (name === gl.BLUE_BITS) return 8
          if (name === gl.ALPHA_BITS) return 8
          if (name === gl.DEPTH_BITS) return 24
          if (name === gl.STENCIL_BITS) return 8
          if (name === gl.MAX_COLOR_ATTACHMENTS) return 4
          if (name === gl.MAX_RENDERBUFFER_SIZE) return 4096
          if (name === gl.SUBPIXEL_BITS) return 8
          // if (name === gl.ALIASED_POINT_SIZE_RANGE) return 0
          // if (name === gl.ALIASED_LINE_WIDTH_RANGE) return 0
          if (name === gl.MAX_VIEWPORT_DIMS) return [ 16384, 16384]
          if (name === gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) return 16
          if (name === gl.MAX_TEXTURE_IMAGE_UNITS) return 16
          if (name === gl.MAX_VERTEX_ATTRIBS) return 16
          if (name === gl.MAX_VERTEX_UNIFORM_VECTORS) return 16
          if (name === gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) return 16
          if (name === gl.MAX_VARYING_VECTORS) return 16
          if (name === gl.MAX_FRAGMENT_UNIFORM_VECTORS) return 16
          console.log(getEnumName(name) + ' not supported')
          glGetParameter.apply(gl, arguments)
        }
        gl.getContextAttributes = function () {
          return {
            alpha: true,
            antialias: true,
            depth: true,
            failIfMajorPerformanceCaveat: false,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            stencil: false
          }
        }
      }

      var regl = this._regl = require('regl')(gl)
      random.seed(10)

      // gui.addParam('Sun Elevation', this, 'elevation', { min: -90, max: 180 }, this.updateSunPosition.bind(this))
      var renderer = this.renderer = new Renderer(regl, this.getWidth(), this.getHeight())

      // gui.addParam('Exposure', this.renderer._state, 'exposure', { min: 0.01, max: 5})
      // gui.addParam('Shadow Bias', this.renderer._state, 'bias', { min: 0.001, max: 0.1})
      // gui.addParam('SSAO', this.renderer._state, 'ssao')
      // gui.addParam('SSAO Sharpness', this.renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
      // gui.addParam('SSAO Radius', this.renderer._state, 'ssaoRadius', { min: 0, max: 1 })

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
        // gui.addTexture2D('EnvMap', envMapTex, { hdr: true })
        renderer._state.skyEnvMap = envMapTex
      }
      // gui.addTexture2D('SkyEnvMap', renderer._skyEnvMapTex, { hdr: true })
      // gui.addTextureCube('Reflection Map PREM', renderer._reflectionProbe.getReflectionMap(), { hdr: true })
      // gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true })
      // gui.addTexture2D('Color', renderer._frameColorTex, { hdr: true }).setPosition(180, 10)
      // gui.addTexture2D('Normals', renderer._frameNormalTex)
      // gui.addTexture2D('Depth', renderer._frameDepthTex)
      // gui.addTexture2D('Reflection OctMap', renderer._reflectionProbe._reflectionOctMap, { hdr: true })

      this.camera = new PerspCamera(45, this.getAspectRatio(), 0.1, 50.0)
      this.camera.lookAt([0, 3, 8], [0, 0, 0])
      var cameraNode = renderer.createNode({
        camera: this.camera
      })
      renderer.add(cameraNode)

      this.arcball = new Arcball(this.camera, this.getWidth(), this.getHeight())
      this.addEventListener(this.arcball)

      // gui.addTexture2D('Shadow Map', renderer._sunLightNode.data.light._shadowMap)

      // http://stackoverflow.com/a/36481059
      var mesh = createCube(0.2, 0.5 + Math.random(), 0.2)
      var i
      var x
      var y
      var z
      var s
      for (i = 0; i < 100; i++) {
        x = randn_bm() * 8 / 3
        z = randn_bm() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        renderer.add(renderer.createNode({
          mesh: mesh,
          position: [x, y, z],
          scale: [1, s, 1],
          material: {
            albedoColor: [0.9, 0.9, 0.9, 1.0],
            rougness: 0.7,
            metallic: 0.0
          }
        }))
      }

      var sphereMesh = createSphere(0.2 + Math.random())
      for (i = 0; i < 10; i++) {
        x = rand() * 8 / 3
        z = rand() * 8 / 3
        y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
        s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
        renderer.add(renderer.createNode({
          mesh: sphereMesh,
          position: [x, y, z],
          scale: [s, s, s],
          material: {
            baseColor: gradient(Math.random()).concat(1),
            rougness: 0.91,
            metallic: 1.0
          }
        }))
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
      renderer.add(renderer.createNode({
        mesh: { positions: positions },
        primitiveType: ctx.LINE_STRIP,
        material: {
          baseColor: [0.9, 0.9, 0.2, 1],
          roughness: 1
        }
      }))

      renderer.add(renderer.createNode({
        mesh: createCube(0.2, 0.5 + Math.random(), 0.2),
        position: [2, 1, 0]
      }))

      ctx.setLineWidth(5)

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
  updateSunPosition: function () {
    Mat4.setRotation(this.elevationMat, this.elevation / 180 * Math.PI, [0, 0, 1])
    Mat4.setRotation(this.rotationMat, this.azimuth / 180 * Math.PI, [0, 1, 0])

    // TODO: set sun direction

    Vec3.set3(this.renderer._state.sunPosition, 1, 0, 0)
    Vec3.multMat4(this.renderer._state.sunPosition, this.elevationMat)
    Vec3.multMat4(this.renderer._state.sunPosition, this.rotationMat)
  },
  // buildMesh: function (geometry, primitiveType) {
    // var ctx = this.getContext()
    // var attributes = [
      // { data: geometry.positions, location: ctx.ATTRIB_POSITION },
      // { data: geometry.uvs || geometry.positions, location: ctx.ATTRIB_TEX_COORD_0 },
      // { data: geometry.normals || geometry.positions, location: ctx.ATTRIB_NORMAL }
    // ]
    // var indices = { data: geometry.cells }
    // return ctx.createMesh(attributes, geometry.cells ? indices : null, primitiveType)
  // },
  draw: function () {
    if (this.getTime().getElapsedFrames() % 600 === 0) {
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
      this.renderer.draw()
    } catch(e) {
      console.log(e)
      console.log(e.stack)
      process.exit(-1)
    }

    if (this.getTime().getElapsedFrames() % 600 === 0) {
      this.renderer._state.profile = false
      // this.renderer._cmdQueue.profile = false
      this.getContext().getGL().finish()
      console.timeEnd('App:frame')
      console.log('App:fps:', this.getTime().getFPS())
    }

    this._regl.poll()
  }
})
