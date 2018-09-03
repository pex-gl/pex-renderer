const promisify = require('util.promisify')
const loadJSON = promisify(require('pex-io/loadJSON'))
const loadImage = promisify(require('pex-io/loadImage'))
// const loadBinary = require('pex-io/loadBinary')
const createCube = require('primitive-cube')
// const createBox = require('primitive-box')
// const isBrowser = require('is-browser')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const createRenderer = require('../../../pex-renderer')
const createContext = require('pex-context')
// const path = require('path')
const GUI = require('pex-gui')
const debug = require('debug')('gltf')
// const parseHdr = require('parse-hdr')
// const random = require('pex-random')
// const log = require('debug')('gltf')
// const createLoft = require('./geom-loft')
// const triangulate = require('./geom-triangulate')
// const normals = require('angle-normals')
const loadGltf = require('./gltf-load')
const buildGltf = require('./gltf-build')

const ctx = createContext({
  powerPreference: 'high-performance'
})
ctx.gl.canvas.style.width = window.innerWidth + 'px'
ctx.gl.canvas.style.height = window.innerHeight + 'px'
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 2,
  // pauseOnBlur: true,
  profile: true,
  profileFlush: false
})

const gui = new GUI(ctx)
gui.addFPSMeeter()
// gui.toggleEnabled()
gui.addHeader('Settings')

const State = {
  sunPosition: [2, 2, 2],
  elevation: 60,
  azimuth: 45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  selectedModel: '',
  scenes: [],
  loadAll: false
}

const positions = [[0, 0, 0], [0, 0, 0]]
function addLine (a, b) {
  positions.push(a, b)
}

const lineBuilder = renderer.add(renderer.entity([
  renderer.geometry({
    positions: positions,
    count: 2,
    primitive: ctx.Primitive.Lines
  }),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: true,
    receiveShadows: true
  })
]))

async function loadScene (url, cb) {
  if (!State.loadAll && State.scene) {
    renderer.remove(State.scene.root)
    //TODO: dispose old scene
  }
  debug(`Loading scene from ${url}`)
  const gltf = await loadGltf(url)
  const scene = State.scene = buildGltf(gltf, ctx, renderer)
  renderer.add(scene.root)
  cb(null, scene)
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    direction: vec3.sub(vec3.create(), State.sunPosition),
    color: [1, 1, 0.95, 1],
    intensity: 5,
    castShadows: true,
    bias: 0.2
  })
  renderer.add(renderer.entity([
    renderer.transform({
      position: State.sunPosition,
      rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([-2, -2, -2]))
    }),
    sun
  ])).name = 'sun'

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition
  })
  renderer.add(renderer.entity([ skybox ])).name = 'skybox'

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })
  renderer.add(renderer.entity([ reflectionProbe ])).name = 'reflectionProbe'
}

function initCamera () {
  const cameraCmp = State.camera = renderer.camera({
    fov: 0.8,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100,
    exposure: 1,
    fxaa: true,
     // dof: true,
    // dofIterations: 1,
    // dofRange: 0.15,
    // dofRadius: 2,
    // dofDepth: 1,
    postprocess: true,
    ssao: true,
    ssaoIntensity: 2,
    ssaoRadius: 1,
    ssaoBias: 0.02,
    ssaoBlurRadius: 0.1, // 2
    ssaoBlurSharpness: 10// 10,
    // ssaoRadius: 5,
  })
  const orbiterCmp = renderer.orbiter({
    position: [4, 4, 4]
  })

  renderer.add(renderer.entity([
    cameraCmp,
    orbiterCmp
  ])).name = 'camera' // TODO: set name in entity constructor?
}

initCamera()
initSky()
let debugOnce = false

window.addEventListener('keypress', (e) => {
  if (e.key === 'd') {
    console.log('debug once')
    debugOnce = true
  }
  if (e.key === 'g') {
    gui.toggleEnabled()
  }
})
// const modelsPath = 'glTF-Sample-Models'
const modelsPath = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0'

function textureFromImage (img) {
  var tex = ctx.texture2D({
    data: img,
    width: img.width,
    height: img.height,
    encoding: ctx.Encoding.SRGB,
    pixelFormat: ctx.PixelFormat.RGBA8,
    flipY: true
  })
  return tex
}

async function init () {
  gui.addParam('Exposure', State.camera, 'exposure', { min: 0, max: 5 }, () => {
    State.camera({ exposure: State.camera.exposure })
  })

  const models = await loadJSON(`${modelsPath}/model-index.json`)
  const screenshots = await Promise.all(
    models.map((model) => loadImage({ url: `${modelsPath}/${model.name}/${model.screenshot}`, crossOrigin: 'anonymous' }), null)
  )
  var thumbnails = screenshots.map(textureFromImage).map((tex, i) => ({
    value: models[i],
    texture: tex
  }))
  gui.addTexture2DList('Models', State, 'selectedModel', thumbnails, 4, (model) => {
    console.log('gltf', 'clicked', model.name)
    loadScene(`${modelsPath}/${model.name}/glTF/${model.name}.gltf`, onSceneLoaded)
  })

  if (State.loadAll) {
    models.forEach((model) => {
      loadScene(`${modelsPath}/${model.name}/glTF/${model.name}.gltf`, onSceneLoaded)
    })
  } else {
    let modelName = 'DamagedHelmet'
    modelName = 'NormalTangentMirrorTest'
    modelName = 'NormalTangentTest'
    loadScene(`${modelsPath}/${modelName}/glTF/${modelName}.gltf`, onSceneLoaded)
  }
}

init()

function onSceneLoaded (err, scene) {
  if (!State.loadAll) {
    while (State.scenes.length) {
      const oldScene = State.scenes.shift()
      oldScene.entities.forEach((e) => e.dispose())
    }
  }

  console.log('onSceneLoaded', err, scene)

  if (err) {
    console.log(err)
  } else {
    var i = State.scenes.length
    var x = 2 * (i % 7) - 7 + 1
    var z = 2 * (Math.floor(i / 7)) - 7 + 1
    if (!State.loadAll) {
      x = z = 0
    }
    scene.root.transform.set({
      position: [x, scene.root.transform.position[1], z]
    })
    State.scenes.push(scene)
  }
}

const floor = renderer.entity([
  renderer.transform({
    position: [0, -0.051, 0]
  }),
  renderer.geometry(createCube(State.loadAll ? 14 : 4, 0.1, State.loadAll ? 14 : 4)),
  renderer.material({
    baseColor: [0.8, 0.8, 0.8, 1],
    metallic: 0,
    roughness: 1,
    castShadows: true,
    receiveShadows: true
  })
])
floor.name = 'floor'
renderer.add(floor)

/*
const originX = renderer.add(renderer.entity([
  renderer.transform({
    position: [1, 0, 0]
  }),
  renderer.geometry(createCube(2, 0.02, 0.02)),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originX.name = 'originX'

const originY = renderer.add(renderer.entity([
  renderer.transform({
    position: [0, 1, 0]
  }),
  renderer.geometry(createCube(0.02, 2, 0.02)),
  renderer.material({
    baseColor: [0, 1, 0, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originY.name = 'originY'

const originZ = renderer.add(renderer.entity([
  renderer.transform({
    position: [0, 0, 1]
  }),
  renderer.geometry(createCube(0.02, 0.02, 2)),
  renderer.material({
    baseColor: [0, 0, 1, 1],
    castShadows: true,
    receiveShadows: true
  })
]))
originZ.name = 'originZ'
*/

let pp = null
let pq = null
let frame = 0
function addPointLine (skin, i, j) {
  var p = [
    State.positions[i * 3],
    State.positions[i * 3 + 1],
    State.positions[i * 3 + 2]
  ]
  var np = [0, 0, 0]
  vec3.add(np, vec3.scale(vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 0]]), State.weights[i * 4 + 0]))
  vec3.add(np, vec3.scale(vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 1]]), State.weights[i * 4 + 1]))
  vec3.add(np, vec3.scale(vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 2]]), State.weights[i * 4 + 2]))
  vec3.add(np, vec3.scale(vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 3]]), State.weights[i * 4 + 3]))
  var q = [
    State.positions[j * 3],
    State.positions[j * 3 + 1],
    State.positions[j * 3 + 2]
  ]
  var nq = [0, 0, 0]
  vec3.add(nq, vec3.scale(vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 0]]), State.weights[j * 4 + 0]))
  vec3.add(nq, vec3.scale(vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 1]]), State.weights[j * 4 + 1]))
  vec3.add(nq, vec3.scale(vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 2]]), State.weights[j * 4 + 2]))
  vec3.add(nq, vec3.scale(vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 3]]), State.weights[j * 4 + 3]))

  if (pp && pq) {
    // positions.length = 0
    addLine(pp, np)
    addLine(pq, nq)
    // vec3.set(np, p)
    // vec3.multMat4(np, State.body.transform.modelMatrix)
    // addLine([0, 0, 0], np)
    // vec3.set(nq, q)
    // vec3.multMat4(nq, State.body.transform.modelMatrix)
    if (frame++ % 10 === 0) {
      addLine(np, nq)
    }
  }
  pp = np
  pq = nq
}

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  if (State.body) {
    // var worldMatrix = State.body.transform.worldMatrix
    var skin = State.body.getComponent('Skin')
    addPointLine(skin, State.minXi, State.maxXi)
    lineBuilder.getComponent('Geometry').set({
      positions: positions,
      count: positions.length
    })
  }

  if (!renderer._state.paused) {
    gui.draw()
  }
})
