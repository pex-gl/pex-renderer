const mat4 = require('pex-math/mat4')
const vec3 = require('pex-math/vec3')
const quat = require('pex-math/quat')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createRenderer = require('../../')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
const gridCells = require('grid-cells')
const path = require('path')
dragon.positions = centerAndNormalize(dragon.positions)
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') gui.toggleEnabled()
})

const State = {
  elevation: 35,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: [],
  exposure: 1
}

random.seed(10)

const renderer = createRenderer({
  pauseOnBlur: true,
  ctx: ctx,
  // profile: true,
  shadowQuality: 2
})

const gui = createGUI(ctx)
// gui.setEnabled(false)
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)

function updateSunPosition () {
  const elevationMat = mat4.create()
  const rotationMat = mat4.create()
  mat4.setRotation(elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  mat4.setRotation(rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  let sunPosition = [10, 0, 0]
  vec3.multMat4(sunPosition, elevationMat)
  vec3.multMat4(sunPosition, rotationMat)

  if (State.sun) {
    var sunDir = State.sun.direction
    vec3.set(sunDir, [0, 0, 0])
    vec3.sub(sunDir, sunPosition)
    State.sun.set({ direction: sunDir })
  }

  if (State.skybox) {
    State.skybox.set({ sunPosition: State.sunPosition })
  }

  if (State.reflectionProbe) {
    State.reflectionProbe.dirty = true // FIXME: hack
  }
}

const W = ctx.gl.drawingBufferWidth
const H = ctx.gl.drawingBufferHeight
const nW = 2
const nH = 2

// flip upside down as we are using viewport coordinates
let cells = gridCells(W, H, nW, nH, 0).map((cell) => {
  return [cell[0], H - cell[1] - cell[3], cell[2], cell[3]]
})

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: (W / nW) / (H / nH),
    position: [0, 0, 1.6],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  var cameraCmp0 = null
  cells.forEach((cell, cellIndex) => {
    const tags = ['cell' + cellIndex]
    const cameraCmp = renderer.camera({
      camera: camera,
      viewport: cell,
      fxaa: true,
      // ssao: true,
      ssaoRadius: 2,
      ssaoBlurRadius: 0.75
    })
    if (cellIndex == 0) cameraCmp0 = cameraCmp
    renderer.add(renderer.entity([
      cameraCmp
    ], tags))
  })

  gui.addParam('FXAA', cameraCmp0, 'fxaa')
  gui.addParam('SSAO', cameraCmp0, 'ssao')
  gui.addParam('SSAO radius', cameraCmp0, 'ssaoRadius', { min: 0, max: 5 })
  gui.addParam('SSAO blur', cameraCmp0, 'ssaoBlurRadius', { min: 0, max: 5 })

  gui.addParam('Exposure',  State, 'exposure', { min: 0.01, max: 5 }, () => {
    renderer.getComponents('Camera').forEach((camera) => {
      camera.set({ exposure: State.exposure })
    })
  })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

}

function imageFromFile (file, options) {
  const tex = ctx.texture2D({
    width: 1,
    height: 1,
    pixelFormat: ctx.PixelFormat.RGBA8,
    encoding: ctx.Encoding.SRGB
  })
  io.loadImage(file, function (err, image, encoding) {
    console.log('image loaded', file)
    if (err) console.log(err)
    ctx.update(tex, {
      data: image,
      width: image.width,
      height: image.height,
      wrap: ctx.Wrap.Repeat,
      flipY: true,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.LinearMipmapLinear,
      pixelFormat: ctx.PixelFormat.RGBA8,
      encoding: encoding
    })
    ctx.update(tex, { mipmap: true })
  }, true)
  return tex
}

function initMeshes () {
  renderer.add(renderer.entity([
    renderer.geometry(dragon),
    renderer.material({
      baseColor: [0.5, 1, 0.7, 1],
      roughness: 0.27,
      metallic: 0.0,
      receiveShadows: true,
      castShadows: true
    })
  ]))

  renderer.add(renderer.entity([
    renderer.transform({
      position: [0, -0.42, 0]
    }),
    renderer.geometry(createCube(2, 0.1, 2)),
    renderer.material({
      baseColor: [1, 1, 1, 1],
      roughness: 2 / 5,
      metallic: 0,
      receiveShadows: true,
      castShadows: true
    })
  ]))
}

function makeCircle (opts) {
  const points = []

  for (let i = 0; i < opts.steps; i++) {
    const t = i / opts.steps * 2 * Math.PI
    const x = Math.cos(t)
    const y = Math.sin(t)
    const pos = [0, 0, 0]
    pos[opts.axis ? opts.axis[0] : 0] = x
    pos[opts.axis ? opts.axis[1] : 1] = y
    vec3.scale(pos, opts.radius || 1)
    vec3.add(pos, opts.center || [0, 0, 0])
    points.push(pos)
  }

  const lines = points.reduce((lines, p, i) => {
    lines.push(p)
    lines.push(points[(i + 1) % points.length])
    return lines
  }, [])

  return lines
}

function makePrism (opts) {
  const r = opts.radius
  const position = opts.position || [0, 0, 0]
  const points = [
    [0, r, 0], [r, 0, 0],
    [0, -r, 0], [r, 0, 0],

    [0, r, 0], [-r, 0, 0],
    [0, -r, 0], [-r, 0, 0],

    [0, r, 0], [0, 0, r],
    [0, -r, 0], [0, 0, r],

    [0, r, 0], [0, 0, -r],
    [0, -r, 0], [0, 0, -r],

    [-r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, -r],
    [r, 0, 0], [0, 0, r],
    [-r, 0, 0], [0, 0, r]
  ]
  points.forEach((p) => vec3.add(p, position))
  return points
}

function makeQuad (opts) {
  const w = opts.width
  const h = opts.height
  const position = opts.position || [0, 0, 0]
  const points = [
    [-1, -1, 0], [1, -1, 0],
    [1, -1, 0], [1, 1, 0],
    [1, 1, 0], [-1, 1, 0],
    [-1, 1, 0], [-1, -1, 0],
    [-1, -1, 0], [1, 1, 0],
    [-1, 1, 0], [1, -1, 0],

    [-1, -1, 0], [-1, -1, 1 / 2],
    [1, -1, 0], [1, -1, 1 / 2],
    [1, 1, 0], [1, 1, 1 / 2],
    [-1, 1, 0], [-1, 1, 1 / 2],
    [0, 0, 0], [0, 0, 1 / 2]
  ]
  points.forEach((p) => {
    p[0] *= w / 2
    p[1] *= h / 2
    vec3.add(p, position)
  })
  return points
}

function initSky () {
  const directionalLight = renderer.directionalLight({
    direction: vec3.normalize([-1, -1, -1]),
    color: [1, 1, 1, 1],
    intensity: 2,
    castShadows: true
  })
  const directionalLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat([
    [0, 0, 0.3], [0, 0, 1],
    [0.3, 0, 0], [0.3, 0, 1],
    [-0.3, 0, 0], [-0.3, 0, 1],
    [0, 0.3, 0], [0, 0.3, 1],
    [0, -0.3, 0], [0, -0.3, 1]
  ])
  State.sun = directionalLight

  // if (false)
  renderer.add(renderer.entity([
    renderer.transform({
      position: [1, 1, 1],
      rotation: quat.fromDirection(quat.create(), directionalLight.direction)
    }),
    renderer.geometry({
      positions: directionalLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: directionalLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [1, 1, 0, 1]
    }),
    directionalLight
  ], ['cell0']))

  gui.addTexture2D('Light', directionalLight._shadowMap)

  var numLights = 0
  for (var i = 0; i < numLights; i++) {
    var a = Math.PI * 2 * i / numLights
    var x = Math.cos(a)
    var y = Math.sin(a)
    // var c = [Math.random(), Math.random(), Math.random(), 1]
    var c = [1, 1, 1, 1]
    const light = renderer.directionalLight({
      direction: vec3.normalize([x, -1 + 0.5 * Math.cos(a), y]),
      color: c,
      intensity: 1,
      castShadows: true
    })
    var gizmo = renderer.geometry({
      positions: directionalLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: directionalLightGizmoPositions.length
    })
    var mat = renderer.material({
      baseColor: [1, 1, 0, 1]
    })
    var t = renderer.transform({
      position: vec3.scale(vec3.copy(light.direction), -1),
      rotation: quat.fromDirection(quat.create(), light.direction)
    })
    renderer.add(renderer.entity([ t, light, gizmo, mat ], ['cell0']))
    gui.addTexture2D('Light ' + i, light._shadowMap)
  }

  const spotLight = renderer.spotLight({
    direction: vec3.normalize([-1, -1, -1]),
    color: [1, 1, 1, 1],
    intensity: 2,
    distance: 3,
    angle: Math.PI / 6,
    castShadows: true
  })
  const spotLightRadius = spotLight.distance * Math.tan(spotLight.angle)
  const spotLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat([
    [0, 0, 0], [spotLightRadius, 0, spotLight.distance],
    [0, 0, 0], [-spotLightRadius, 0, spotLight.distance],
    [0, 0, 0], [0, spotLightRadius, spotLight.distance],
    [0, 0, 0], [0, -spotLightRadius, spotLight.distance]
  ])
  .concat(makeCircle({ radius: spotLightRadius, center: [0, 0, spotLight.distance], steps: 64, axis: [0, 1]}))
  gui.addParam('Spotlight angle', spotLight, 'angle', { min: 0, max: Math.PI / 2 }, () => {
    spotLight.set({ angle: spotLight.angle })
  })

  renderer.add(renderer.entity([
    renderer.transform({
      position: [1, 1, 1],
      rotation: quat.fromDirection(quat.create(), spotLight.direction)
    }),
    renderer.geometry({
      positions: spotLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: spotLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [1, 0, 1, 1]
    }),
    spotLight
  ], ['cell1']))

  const pointLight = renderer.pointLight({
    color: [1, 1, 1, 1],
    intensity: 2,
    radius: 3,
    castShadows: true
  })
  const pointLightGizmoPositions = makePrism({ radius: 0.3 })
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLight.radius, steps: 64, axis: [0, 1] }))
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLight.radius, steps: 64, axis: [0, 2] }))
  .concat(makeCircle({ center: [0, 0, 0], radius: pointLight.radius, steps: 64, axis: [1, 2] }))
  .concat([
    [0, 0.3, 0], [0, 0.6, 0],
    [0, -0.3, 0], [0, -0.6, 0],
    [0.3, 0, 0], [0.6, 0, 0],
    [-0.3, 0, 0], [-0.6, 0, 0],
    [0, 0, 0.3], [0, 0, 0.6],
    [0, 0, -0.3], [0, 0, -0.6]
  ])

  renderer.add(renderer.entity([
    renderer.transform({
      position: [1, 1, 1]
    }),
    renderer.geometry({
      positions: pointLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: pointLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [1, 1, 1, 1]
    }),
    pointLight
  ], ['cell2']))

  const areaLight = renderer.areaLight({
    color: [1, 1, 1, 1],
    intensity: 2,
    castShadows: true
  })
  const areaLightGizmoPositions = makeQuad({ width: 1, height: 1})
  renderer.add(renderer.entity([
    renderer.transform({
      scale: [2, 0.5, 1],
      position: [1, 1, 1],
      rotation: quat.fromDirection(quat.create(), [-1, -1, -1])
    }),
    renderer.geometry({
      positions: areaLightGizmoPositions,
      primitive: ctx.Primitive.Lines,
      count: areaLightGizmoPositions.length
    }),
    renderer.material({
      baseColor: [0, 1, 1, 1]
    }),
    areaLight
  ], ['cell3']))

  const skybox = State.skybox = renderer.skybox({
    sunPosition: vec3.normalize([1, 1, 1])
  })
  // renderer.add(renderer.entity([ skybox ]))

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })
  // renderer.add(renderer.entity([ reflectionProbe ]))
}

initCamera()
initMeshes()
initSky()

let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') {
    debugOnce = true
    updateSunPosition()
  }
})

updateSunPosition()

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  if (!renderer._state.paused) { // TODO: _state.something is messy
    gui.draw()
  }
})
