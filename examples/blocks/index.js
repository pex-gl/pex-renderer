const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const Renderer = require('../../')
const createSphere = require('primitive-sphere')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
// const parseHdr = require('./local_modules/parse-hdr')
const cosineGradient = require('cosine-gradient')
const createContext = require('pex-context')

const scheme = [[0.000, 0.500, 0.500], [0.000, 0.500, 0.500], [0.000, 0.500, 0.333], [0.000, 0.500, 0.667]]

// Standard Normal variate using Box-Muller transform.
// http://stackoverflow.com/a/36481059
function randnBM () {
  var u = 1 - Math.random() // Subtraction to flip [0, 1) to (0, 1].
  var v = 1 - Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function rand () {
  return (Math.random() * 2 - 1) * 3
}

const gradient = cosineGradient(scheme[0], scheme[1], scheme[2], scheme[3])

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: 0,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create()
}

random.seed(10)

const renderer = new Renderer(ctx, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight)

const gui = createGUI(ctx)
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(renderer._state.sunPosition, 1, 0, 0)
  Vec3.multMat4(renderer._state.sunPosition, State.elevationMat)
  Vec3.multMat4(renderer._state.sunPosition, State.rotationMat)
}

gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
gui.addParam('SSAO', renderer._state, 'ssao')
gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

function initCamera () {
  const camera = createCamera({
    fov: 45 / 180 * Math.PI,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 3, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 50
  })

  var cameraEntity = renderer.entity([
    renderer.camera({ camera: camera })
  ])
  renderer.add(cameraEntity)

  createOrbiter({ camera: camera })
}

function buildMesh (geometry, primitiveType) {
  if (primitiveType) throw new Error('primitiveType not supported yet')
  return {
    attributes: {
      aPosition: ctx.vertexBuffer(geometry.positions),
      aTexCoord0: ctx.vertexBuffer(geometry.uvs),
      aNormal: ctx.vertexBuffer(geometry.normals)
    },
    indices: ctx.indexBuffer(geometry.cells)
  }
}

function initCubes () {
  var mesh = buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2))
  for (let i = 0; i < 1000; i++) {
    const x = randnBM() * 8 / 3
    const z = randnBM() * 8 / 3
    const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
    const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
    const c = random.float(0.7, 0.9)
    renderer.add(renderer.createNode({
      mesh: mesh,
      position: [x, y, z],
      scale: [1, s, 1],
      material: {
        baseColor: [c, c, c, 1],
        rougness: 0.7,
        metallic: 0.0
      }
    }))
  }
}

function initFloor () {
  const floorMesh = buildMesh(createCube(14, 0.02, 14))
  renderer.add(renderer.createNode({
    mesh: floorMesh,
    position: [0, -0.3, 0]
  }))
}

function initSpheres () {
  const sphereMesh = buildMesh(createSphere(0.2 + Math.random()))
  for (let i = 0; i < 100; i++) {
    const x = rand() * 8 / 3
    const z = rand() * 8 / 3
    const y = 2 * random.noise2(x / 2, z / 2) + random.noise2(2 * x, 2 * z)
    const s = Math.max(0.0, 3.0 - Math.sqrt(x * x + z * z) / 2)
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
}

function initLights () {
  var sunDir = Vec3.normalize([1, -1, 1])
  var sunLightNode = renderer.createNode({
    light: {
      type: 'directional',
      color: [1, 1, 0, 1],
      direction: sunDir
    }
  })
  // renderer.add(sunLightNode)

  gui.addTexture2D('Shadow Map', renderer._sunLightNode.data.light._shadowMap)
  const sphereMesh = buildMesh(createSphere(0.2))
  var pointLight = renderer.createNode({
    mesh: sphereMesh,
    position: [2, 2, 2],
    material: {
      baseColor: [1, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    },
    light: {
      type: 'point',
      position: [2, 2, 2],
      color: [1, 0, 0, 1],
      radius: 50
    }
  })
  // renderer.add(pointLight)

  var areaLightMesh = buildMesh(createCube(1))
  var areaLightColor = [0, 1, 0, 1]
  var areaLightNode = renderer.createNode({
    enabled: true,
    position: [5, 2, 0],
    scale: [2, 5, 0.1],
    rotation: Quat.fromDirection(Quat.create(), [-1, 0, 0]),
    mesh: areaLightMesh,
    material: {
      emissiveColor: areaLightColor,
      baseColor: [0, 0, 0, 1],
      metallic: 1.0,
      roughness: 0.74
    },
    light: {
      type: 'area',
      intensity: 2,
      color: areaLightColor
    }
  })
  gui.addParam('AreaLight Size', areaLightNode.data, 'scale', { min: 0, max: 5 }, (value) => {
    areaLightNode.setScale(value[0], value[1], value[2])
  })
  gui.addParam('AreaLight Intensity', areaLightNode.data.light, 'intensity', { min: 0, max: 5 })
  gui.addParam('AreaLight', areaLightNode.data.light, 'color', { type: 'color' })
  renderer.add(areaLightNode)
}

initCamera()
initCubes()
initFloor()
initSpheres()
initLights()

let frameNumber = 0
let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

updateSunPosition()

ctx.frame(() => {
  // ctx.debug(frameNumber++ == 1)
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})


/*
Window.create({
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
      gui.addTextureCube('Reflection Map PREM', renderer._reflectionProbe.getReflectionMap(), { hdr: true })
      gui.addTextureCube('Irradiance Map', renderer._reflectionProbe.getIrradianceMap(), { hdr: true })
      gui.addTexture2D('Color', renderer._frameColorTex, { hdr: true }).setPosition(180, 10)
      gui.addTexture2D('Normals', renderer._frameNormalTex)
      gui.addTexture2D('Depth', renderer._frameDepthTex)
      // gui.addTexture2D('Reflection OctMap', renderer._reflectionProbe._reflectionOctMap, { hdr: true })


      // http://stackoverflow.com/a/36481059

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
        mesh: this.buildMesh({ positions: positions }, ctx.LINE_STRIP),
        material: {
          baseColor: [0.9, 0.9, 0.2, 1],
          roughness: 1
        }
      }))

      renderer.add(renderer.createNode({
        mesh: this.buildMesh(createCube(0.2, 0.5 + Math.random(), 0.2)),
        position: [2, 1, 0]
      }))

      ctx.setLineWidth(5)


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
  draw: function () {
    if (this.getTime().getElapsedFrames() % 30 === 0) {
      this.getContext().getGL().finish()
      console.time('App:frame')
      this.renderer._state.profile = true
      this.renderer._cmdQueue.profile = true
    }

    if (this.getTime().getElapsedFrames() <= 1) {
      this.renderer._cmdQueue.debug = true
    } else {
      this.renderer._cmdQueue.debug = false
    }

    if (this.getTime().getElapsedFrames() % 30 === 0) {
      this.renderer._state.profile = false
      this.renderer._cmdQueue.profile = false
      this.getContext().getGL().finish()
      console.timeEnd('App:frame')
      console.log('App:fps:', this.getTime().getFPS())
    }
  }
})
*/
