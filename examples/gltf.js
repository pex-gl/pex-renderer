const createRenderer = require('../')
const createContext = require('pex-context')
const createGUI = require('pex-gui')
const loadJSON = require('pex-io/loadJSON')
const loadImage = require('pex-io/loadImage')
const loadBinary = require('pex-io/loadBinary')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const path = require('path')
const createCube = require('primitive-cube')
const parseHdr = require('parse-hdr')
const isBrowser = require('is-browser')
const createBox = require('primitive-box')
const edges = require('geom-edges')
const aabb = require('pex-geom/aabb')

const { makeAxes } = require('./helpers')

const MODELS_PATH =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0'

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')

const State = {
  sunPosition: [2, 2, 2],
  selectedModel: '',
  scenes: [],
  gridSize: 1,
  showBoundingBoxes: false,
  useEnvMap: true,
  shadows: false,
  formats: ['glTF', 'glTF-Binary', 'glTF-Draco', 'glTF-Embedded'],
  currentFormat: 0
}

const FORMAT_EXTENSION = new Map()
  .set('glTF', 'gltf')
  .set('glTF-Binary', 'glb')
  .set('glTF-Draco', 'gltf')
  .set('glTF-Embedded', 'gltf')

// Utils
const positions = [[0, 0, 0], [0, 0, 0]]
const addLine = (a, b) => positions.push(a, b)

let pp = null
let pq = null
let frame = 0
function addPointLine(skin, i, j) {
  var p = [
    State.positions[i * 3],
    State.positions[i * 3 + 1],
    State.positions[i * 3 + 2]
  ]
  var np = [0, 0, 0]
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 0]]),
      State.weights[i * 4 + 0]
    )
  )
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 1]]),
      State.weights[i * 4 + 1]
    )
  )
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 2]]),
      State.weights[i * 4 + 2]
    )
  )
  vec3.add(
    np,
    vec3.scale(
      vec3.multMat4(vec3.copy(p), skin.jointMatrices[State.joints[i * 4 + 3]]),
      State.weights[i * 4 + 3]
    )
  )
  var q = [
    State.positions[j * 3],
    State.positions[j * 3 + 1],
    State.positions[j * 3 + 2]
  ]
  var nq = [0, 0, 0]
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 0]]),
      State.weights[j * 4 + 0]
    )
  )
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 1]]),
      State.weights[j * 4 + 1]
    )
  )
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 2]]),
      State.weights[j * 4 + 2]
    )
  )
  vec3.add(
    nq,
    vec3.scale(
      vec3.multMat4(vec3.copy(q), skin.jointMatrices[State.joints[j * 4 + 3]]),
      State.weights[j * 4 + 3]
    )
  )

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
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-2, -2, -2])
    )
  }),
  renderer.directionalLight({
    color: [1, 1, 0.95, 1],
    intensity: 2,
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

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

const addEnvmap = async () => {
  const buffer = await loadBinary(`${ASSETS_DIR}/garage.hdr`)
  const hdrImg = parseHdr(buffer)
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

  skyboxEntity.getComponent('Skybox').set({ texture: panorama })
  reflectionProbeEntity.getComponent('ReflectionProbe').set({ dirty: true })
}

if (State.useEnvMap) addEnvmap()

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
// renderer.add(lineBuilder)

// glTF
function repositionModel(scene) {
  var n = State.gridSize
  var i = State.scenes.length
  var x = 2 * (i % n) - n + 1
  var z = 2 * Math.floor(i / n) - n + 1
  if (State.selectedModel) {
    x = z = 0
  }
  scene.root.transform.set({
    position: [x, scene.root.transform.position[1], z]
  })
}

function rescaleScene(scene) {
  const sceneBounds = scene.root.transform.worldBounds
  const sceneSize = aabb.size(scene.root.transform.worldBounds)
  const sceneCenter = aabb.center(scene.root.transform.worldBounds)
  const sceneScale =
    1 / (Math.max(sceneSize[0], Math.max(sceneSize[1], sceneSize[2])) || 1)
  if (!aabb.isEmpty(sceneBounds)) {
    scene.root.transform.set({
      position: vec3.scale(
        [-sceneCenter[0], -sceneBounds[0][1], -sceneCenter[2]],
        sceneScale
      ),
      scale: [sceneScale, sceneScale, sceneScale]
    })
  }
}

function onSceneLoaded(scene, grid) {
  State.scenes.push(scene)
  renderer.update() // refresh scene hierarchy

  if (grid) {
    rescaleScene(scene)
    repositionModel(scene)
  }

  if (State.showBoundingBoxes) {
    const box = createBox(1)
    box.cells = edges(box.cells)
    box.primitive = ctx.Primitive.Lines

    const bboxes = scene.entities
      .map((e) => {
        const size = aabb.size(e.transform.worldBounds)
        const center = aabb.center(e.transform.worldBounds)

        const bbox = renderer.add(
          renderer.entity([
            renderer.transform({
              scale: size,
              position: center
            }),
            renderer.geometry(box),
            renderer.material({
              baseColor: [1, 0, 0, 1]
            })
          ])
        )
        bbox.name = e.name + '_bbox'
        return bbox
      })
      .filter((e) => e)
    scene.entities = scene.entities.concat(bboxes)
  }
}

let floorEntity
let cameraEntity

async function loadScene(url, grid) {
  let scene
  try {
    // console.time('building ' + url)
    // All examples only have one scene
    State.scene = scene = await renderer.loadScene(url, {
      includeCameras: !grid
    })
  } catch (e) {
    // console.timeEnd('building ' + url)
    return e
  }

  scene.entities.forEach((entity) => {
    const materialCmp = entity.getComponent('Material')
    if (materialCmp) {
      materialCmp.set({
        castShadows: State.shadows,
        receiveShadows: State.shadows
      })
    }
  })

  renderer.add(scene.root)

  // Add camera for models lacking one
  if (!grid) {
    cameraEntity = scene.entities.find((entity) =>
      entity.components.find((component) => component.type === 'Camera')
    )

    if (!cameraEntity) {
      // Update needed for transform.worldBounds
      renderer.update()
      const far = 10000
      const sceneBounds = scene.root.transform.worldBounds
      // const sceneSize = aabb.size(scene.root.transform.worldBounds)
      const sceneCenter = aabb.center(scene.root.transform.worldBounds)

      const boundingSphereRadius = Math.max.apply(
        Math,
        sceneBounds.map((bound) => vec3.distance(sceneCenter, bound))
      )

      const fov = Math.PI / 4
      const distance = (boundingSphereRadius * 2) / Math.tan(fov / 2)

      cameraEntity = renderer.entity([
        renderer.camera({
          near: 0.01,
          far,
          fov,
          aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
        }),
        renderer.orbiter({
          maxDistance: far,
          target: sceneCenter,
          position: [sceneCenter[0], sceneCenter[1], distance]
        })
      ])
      scene.entities.push(cameraEntity)
      renderer.add(cameraEntity)
    } else {
      const cameraCmp = cameraEntity.getComponent('Camera')
      cameraCmp.set({
        near: 0.5,
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
      })

      // Clipped models: 2CylinderEngine, EnvironmentTest
      // MultiUVTest: wrong position
      if (State.selectedModel.name !== 'MultiUVTest') {
        cameraEntity.addComponent(
          renderer.orbiter({
            // target: sceneCenter,
            // distance: (boundingSphereRadius * 2) / Math.tan(cameraCmp.fov / 2),
            position: cameraEntity.transform.position,
            minDistance: cameraCmp.near,
            maxDistance: cameraCmp.far
          })
        )
      }
    }

    // console.timeEnd('building ' + url)
    scene.url = url
  }

  return scene
}

async function renderModel(model, overrideFormat, grid) {
  const format = overrideFormat || State.formats[State.currentFormat]

  try {
    const scene = await loadScene(
      `${MODELS_PATH}/${model.name}/${format}/${
        model.name
      }.${FORMAT_EXTENSION.get(format)}`,
      grid
    )

    if (scene instanceof Error) {
      throw scene
    } else {
      onSceneLoaded(scene, grid)
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    // eslint-disable-next-line no-console
    console.warn(
      `No format ${format} supported for model ${
        model.name
      }. Defaulting to glTF.`
    )
    if (!overrideFormat) {
      renderModel(model, 'glTF', grid)
    }
  }
}

async function init() {
  // Get list of models locally or from the glTF repo
  let models = await loadJSON(`${MODELS_PATH}/model-index.json`)

  // Add screenshots to the GUI
  const screenshots = await Promise.all(
    models.map(
      (model) =>
        loadImage({
          url: `${MODELS_PATH}/${model.name}/${model.screenshot}`,
          crossOrigin: 'anonymous'
        }),
      null
    )
  )
  const thumbnails = screenshots
    .map((img) =>
      ctx.texture2D({
        data: img,
        width: img.width,
        height: img.height,
        encoding: ctx.Encoding.SRGB,
        pixelFormat: ctx.PixelFormat.RGBA8,
        flipY: true
      })
    )
    .map((tex, i) => ({
      value: models[i],
      texture: tex
    }))
  gui.addRadioList(
    'Format',
    State,
    'currentFormat',
    State.formats.map((name, value) => ({
      name,
      value
    }))
  )
  gui.addTexture2DList(
    'Models',
    State,
    'selectedModel',
    thumbnails,
    4,
    async (model) => {
      // Clean up
      if (State.selectedModel) {
        while (State.scenes.length) {
          const oldScene = State.scenes.shift()
          oldScene.entities.forEach((e) => e.dispose())
        }

        if (State.scene) renderer.remove(State.scene.root)
        if (floorEntity) renderer.remove(floorEntity)
      }

      renderer.remove(cameraEntity)

      renderModel(model)
    }
  )

  // Filter models
  models = models.filter((model) =>
    [
      // '2CylinderEngine',
      // 'AlphaBlendModeTest',
      // 'AnimatedCube',
      // 'AnimatedMorphCube',
      // 'AnimatedMorphSphere',
      // 'AnimatedTriangle',
      // 'AntiqueCamera',
      // 'Avocado',
      // 'BarramundiFish',
      // 'BoomBox',
      // 'BoomBoxWithAxes',
      // 'Box',
      // 'BoxAnimated',
      // 'BoxInterleaved',
      // 'BoxTextured',
      // 'BoxTexturedNonPowerOfTwo',
      // 'BoxVertexColors',
      // 'BrainStem',
      // 'Buggy',
      // 'Cameras',
      // 'CesiumMan',
      // 'CesiumMilkTruck',
      // 'Corset',
      // 'Cube',
      'DamagedHelmet'
      // 'Duck',
      // 'EnvironmentTest',
      // 'FlightHelmet',
      // 'GearboxAssy',
      // 'InterpolationTest',
      // 'Lantern',
      // 'MetalRoughSpheres',
      // 'Monster',
      // 'MorphPrimitivesTest',
      // 'MultiUVTest',
      // 'NormalTangentMirrorTest',
      // 'NormalTangentTest',
      // 'OrientationTest',
      // 'ReciprocatingSaw',
      // 'RiggedFigure',
      // 'RiggedSimple',
      // 'SciFiHelmet',
      // 'SimpleMeshes',
      // 'SimpleMorph',
      // 'SimpleSparseAccessor',
      // 'SpecGlossVsMetalRough',
      // 'Sponza',
      // 'Suzanne',
      // 'TextureCoordinateTest',
      // 'TextureSettingsTest',
      // 'TextureTransformTest',
      // 'Triangle',
      // 'TriangleWithoutIndices',
      // 'TwoSidedPlane',
      // 'UnlitTest',
      // 'VC',
      // 'VertexColorTest',
      // 'WaterBottle'
    ].includes(model.name)
  )

  const grid = models.length > 1

  // Setup for grid view
  if (grid) {
    State.gridSize = Math.ceil(Math.sqrt(models.length))

    cameraEntity = renderer.entity([
      renderer.camera({
        aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight
      }),
      renderer.orbiter({
        position: new Array(3).fill(State.gridSize * 2)
      })
    ])
    renderer.add(cameraEntity)

    floorEntity = renderer.entity([
      renderer.geometry(
        createCube(2 * State.gridSize, 0.1, 2 * State.gridSize)
      ),
      renderer.material({
        baseColor: [0.8, 0.8, 0.8, 1],
        metallic: 0,
        roughness: 1,
        castShadows: State.shadows,
        receiveShadows: State.shadows
      })
    ])
    renderer.add(floorEntity)
  }

  // Render scene(s)
  await Promise.all(
    models.map(async (model) => {
      await renderModel(model, null, grid)
    })
  )

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
}

init()

var debugCommandsOpt = null
function optimizeCommands(commands) {
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
    // var camera = renderer.getComponents('Camera')[0]
    // var orbiter = renderer.getComponents('Orbiter')[0]
    // orbiter.update()
    // camera.entity.transform.update()
    // camera.update()
    // for (let cmd of debugCommandsOpt) {
    //   if (cmd.uniforms) {
    //     cmd.uniforms.viewMatrix = camera.viewMatrix
    //   }
    //   ctx.apply(cmd)
    // }
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
