const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const loadJSON = require('pex-io/loadJSON')
const loadImage = require('pex-io/loadImage')
const loadBinary = require('pex-io/loadBinary')
const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const createCube = require('primitive-cube')
const debug = require('debug')('gltf')
// const log = require('debug')('gltf')
const parseHdr = require('parse-hdr')
const isBrowser = require('is-browser')
const createBox = require('primitive-box')
const edges = require('geom-edges')
const aabb = require('pex-geom/aabb')

const loadGltf = require('./gltf/gltf-load')
const buildGltf = require('./gltf/gltf-build')
const { makeAxes } = require('./helpers')

const MODELS_PATH = 'glTF-Sample-Models'
// const MODELS_PATH = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0'
const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: '',
  scenes: [],
  gridSize: 1,
  showBoundingBoxes: false,
  useEnvMap: false,
  shadows: false // TODO: disabled for benchmarking
}

// Utils
const positions = [[0, 0, 0], [0, 0, 0]]
const addLine = (a, b) => positions.push(a, b)

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

// Start
const ctx = createContext({
  powerPreference: 'high-performance'
})
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const renderer = createRenderer({
  ctx,
  shadowQuality: 3,
  pauseOnBlur: false,
  profile: true,
  profileFlush: false
})

const gui = createGUI(ctx)
gui.addFPSMeeter()

const sunEntity = renderer.entity([
  renderer.transform({
    position: State.sunPosition,
    rotation: quat.fromTo(quat.create(), [0, 0, 1], vec3.normalize([-2, -2, -2]))
  }),
  renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 5,
    castShadows: State.shadows,
    bias: 0.2
  })
])
renderer.add(sunEntity)

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbeEntity)

const addEnvmap = (async () => {
  const buffer = await loadBinary(`${ASSETS_DIR}/garage.hdr`)
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })

  skyboxEntity.getComponent('Skybox').set({ texture: panorama })
  reflectionProbeEntity.getComponent('ReflectionProbe').set({ dirty: true })
})

if (State.useEnvMap) addEnvmap()

const cameraEntity = renderer.entity([
  renderer.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
  }),
  // renderer.postProcessing({
  //   fxaa: true,
  //   ssao: true,
  //   dof: true,
  //   bloom: true
  // }),
  renderer.orbiter({
    position: [2, 2, 2]
  })
])
renderer.add(cameraEntity)

gui.addParam('Exposure', cameraEntity.getComponent('Camera'), 'exposure', { min: 0, max: 5 })

const floorEntity = renderer.entity([
  renderer.transform({
    position: [0, -0.051, 0]
  }),
  renderer.geometry(createCube(4, 0.1, 4)),
  renderer.material({
    baseColor: [0.8, 0.8, 0.8, 1],
    metallic: 0,
    roughness: 1,
    castShadows: State.shadows,
    receiveShadows: State.shadows
  })
])
renderer.add(floorEntity)

const axes = makeAxes(1)
const axesEntity = renderer.entity([
  renderer.transform(),
  renderer.geometry({
    positions: axes,
    primitive: ctx.Primitive.Lines,
    count: axes.length,
    vertexColors: [
      [1, 0, 0, 1],
      [1, 0.8, 0, 1],
      [0, 1, 0, 1],
      [0.8, 1, 0, 1],
      [0, 0, 1, 1],
      [0, 0.8, 1, 1]
    ]
  }),
  renderer.material({
    baseColor: [1, 1, 1, 1]
  })
])
renderer.add(axesEntity)

const lineBuilder = renderer.entity([
  renderer.geometry({
    positions: positions,
    count: 2,
    primitive: ctx.Primitive.Lines
  }),
  renderer.material({
    baseColor: [1, 0, 0, 1],
    castShadows: State.shadows,
    receiveShadows: State.shadows
  })
])
//renderer.add(lineBuilder)

// glTF
function onSceneLoaded (err, scene) {
  if (State.selectedModel) {
    while (State.scenes.length) {
      const oldScene = State.scenes.shift()
      oldScene.entities.forEach((e) => e.dispose())
    }
  }

  if (err) {
    console.log(err)
  } else {
    var n = State.gridSize
    var i = State.scenes.length
    var x = 2 * (i % n) - n + 1
    var z = 2 * (Math.floor(i / n)) - n + 1
    if (State.selectedModel) {
      x = z = 0
    }
    scene.root.transform.set({
      position: [x, scene.root.transform.position[1], z]
    })
    State.scenes.push(scene)

    // Debug scene
    // function printEntity (e, level, s) {
      // s = s || ''
      // level = '  ' + (level || '')
      // var g = e.getComponent('Geometry')
      // s += level + (e.name || 'child') + ' ' + aabbToString(e.transform.worldBounds) + ' ' + aabbToString(e.transform.bounds) + ' ' + (g ? aabbToString(g.bounds) : '') + '\n'
      // if (e.transform) {
        // e.transform.children.forEach((c) => {
          // s = printEntity(c.entity, level, s)
        // })
      // }
      // return s
    // }

    const sceneBounds = scene.root.transform.worldBounds
    const sceneSize = aabb.size(scene.root.transform.worldBounds)
    const sceneCenter = aabb.center(scene.root.transform.worldBounds)
    const sceneScale = 1 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1)
    if (!aabb.isEmpty(sceneBounds)) {
      scene.root.transform.set({
        position: vec3.scale([-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]], sceneScale),
        scale: [sceneScale, sceneScale, sceneScale]
      })
    }

    renderer.update() // refresh scene hierarchy

    var box = createBox(1)
    box.cells = edges(box.cells)
    box.primitive = ctx.Primitive.Lines

    if (State.showBoundingBoxes) {
      const bboxes = scene.entities.map((e) => {
        var size = aabb.size(e.transform.worldBounds)
        var center = aabb.center(e.transform.worldBounds)

        const bbox = renderer.add(renderer.entity([
          renderer.transform({
            scale: size,
            position: center
          }),
          renderer.geometry(box),
          renderer.material({
            baseColor: [1, 0, 0, 1]
          })
        ]))
        bbox.name = e.name + '_bbox'
        return bbox
      }).filter((e) => e)
      scene.entities = scene.entities.concat(bboxes)
    }
  }
}

async function loadScene (url, cb) {
  if (State.selectedModel && State.scene) {
    renderer.remove(State.scene.root)
    // TODO: dispose old scene
  }
  debug(`Loading scene from ${url}`)
  const gltf = await loadGltf(url)
  console.time('building ' + url)
  const scene = State.scene = buildGltf(gltf, ctx, renderer)
  scene.entities.forEach((e) => {
    var mat = e.getComponent('Material')
    if (mat) {
      mat.set({
        castShadows: State.shadows,
        receiveShadows: State.shadows
      })
    }
  })
  console.timeEnd('building ' + url)
  scene.url = url
  renderer.add(scene.root)
  cb(null, scene)
}

async function init () {
  // Get list of models locally or from the glTF repo
  let models = await loadJSON(`${MODELS_PATH}/model-index.json`)

  // Add screenshots to the GUI
  const screenshots = await Promise.all(
    models.map((model) => loadImage({ url: `${MODELS_PATH}/${model.name}/${model.screenshot}`, crossOrigin: 'anonymous' }), null)
  )
  const thumbnails = screenshots
    .map((img) => (
      ctx.texture2D({
        data: img,
        width: img.width,
        height: img.height,
        encoding: ctx.Encoding.SRGB,
        pixelFormat: ctx.PixelFormat.RGBA8,
        flipY: true
      })
    ))
    .map((tex, i) => ({
      value: models[i],
      texture: tex
    }))
  gui.addTexture2DList('Models', State, 'selectedModel', thumbnails, 4, (model) => {
    loadScene(`${MODELS_PATH}/${model.name}/glTF/${model.name}.gltf`, onSceneLoaded)
  })

  // Filter models
  models = [
    { name: 'DamagedHelmet' },
    // { name: '2CylinderEngine' },
    // { name: 'BrainStem' },
    // { name: 'DamagedHelmet' },
    // { name: 'AlphaBlendModeTest' },
    // { name: 'Duck' },
    // { name: 'FlightHelmet' },
    // { name: 'CesiumMan' }
  ]

  State.gridSize = Math.ceil(Math.sqrt(models.length))

  models.forEach((model) => {
    loadScene(`${MODELS_PATH}/${model.name}/glTF/${model.name}.gltf`, onSceneLoaded)
  })
}

init()

var debugCommandsOpt = null
function optimizeCommands (commands) {
  return commands
}

window.addEventListener('resize', () => {
  const W = window.innerWidth
  const H = window.innerHeight
  ctx.set({
    width: W,
    height: H
  })
  cameraEntity.getComponent('Camera').set({
    viewport: [0, 0, W, H]
  })
})

window.addEventListener('keypress', (e) => {
  if (e.key === 'd') {
    debugOnce = true
  }
  if (e.key === 'g') {
    gui.toggleEnabled()
  }
})

let debugOnce = false

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false

  if (ctx.debugCommands && ctx.debugCommands.length) {
    if (!debugCommandsOpt) {
      debugCommandsOpt = optimizeCommands(ctx.debugCommands)
    }
    if (renderer._state.profiler) {
      renderer._state.profiler.startFrame()
    }
    var camera = renderer.getComponents('Camera')[0]
    var orbiter = renderer.getComponents('Orbiter')[0]
    orbiter.update()
    camera.entity.transform.update()
    camera.update()
    for (let cmd of debugCommandsOpt) {
      if (cmd.uniforms) {
        cmd.uniforms.viewMatrix = camera.viewMatrix
      }
      ctx.apply(cmd)
    }
    if (renderer._state.profiler) {
      renderer._state.profiler.endFrame()
    }
  } else {
    renderer.draw()
  }

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
