const createRenderer = require('../')
const createContext = require('pex-context')
const createCube = require('primitive-cube')
const random = require('pex-random')
const { fromHex, fromHSL } = require('pex-color')
const { quat, vec3 } = require('pex-math')
const dutchPalette = [
  '#FFC312',
  '#F79F1F',
  '#EE5A24',
  '#EA2027',
  '#C4E538',
  '#A3CB38',
  '#009432',
  '#006266',
  '#12CBC4',
  '#1289A7',
  '#0652DD',
  '#1B1464',
  '#FDA7DF',
  '#D980FA',
  '#9980FA',
  '#5758BB',
  '#ED4C67',
  '#B53471',
  '#833471',
  '#6F1E51'
].map(fromHex)

const MAX_DEPTH = 8

// returns array of rects [x, y, w, h, depth]
function divide(parent, rects) {
  rects.push(parent)

  var depth = parent[4]

  // var shouldDivide = random.chance(0.4 + 1 / (depth * 0.5 + 1))
  var shouldDivide = random.chance(0.3 + 1 / (depth / 10 + 1))
  if (depth <= 1) {
    shouldDivide = true
  }

  if (depth >= MAX_DEPTH || !shouldDivide) {
    return rects
  }

  if (parent[2] < 0.01 || parent[3] < 0.01) return rects

  var numDivisions = random.int(2, 5)
  var horizontal = random.chance(0.5)
  if (depth === 0) horizontal = false
  if (depth === 1) horizontal = true

  for (var i = 0; i < numDivisions; i++) {
    var child = null
    if (horizontal) {
      child = [
        parent[0] + (parent[2] * i * 1) / numDivisions,
        parent[1],
        (parent[2] * 1) / numDivisions,
        parent[3],
        depth + 1
      ]
    } else {
      child = [
        parent[0],
        parent[1] + (parent[3] * i * 1) / numDivisions,
        parent[2],
        (parent[3] * 1) / numDivisions,
        depth + 1
      ]
    }
    var offset = 0.002
    child[0] += offset
    child[1] += offset
    child[2] -= 2 * offset
    child[3] -= 2 * offset
    divide(child, rects)
  }
  return rects
}

random.seed(0)
var s = 1
const rects = divide([-2 * s, -1 * s, 4 * s, 2 * s, 0], [])

const ctx = createContext({
  pixelRatio: 1
  // width: 1280,
  // height: 800
})
const renderer = createRenderer({
  ctx: ctx,
  shadowQuality: 2
})

const cameraEntity = renderer.entity([
  renderer.transform({ position: [0, 0, 5] }),
  renderer.camera({
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    exposure: 1.5
  }),
  renderer.orbiter({
    position: [-3, 4.5, 3.01]
  }),
  renderer.postProcessing({
    fxaa: true,
    ssao: true,
    ssaoRadius: 2,
    ssaoBlurRadius: 0.5,
    ssaoSharpness: 5,
    ssaoIntensity: 0.5
    // dof: true,
    // dofRange: 1,
    // dofDepth: 6,
    // dofRadius: 2
  })
])
renderer.add(cameraEntity)

renderer.add(
  renderer.entity([
    renderer.geometry(createCube(4, 0.1, 2)),
    renderer.material({
      baseColor: [1, 1, 1, 1],
      receiveShadows: true,
      castShadows: true
    })
  ])
)

const levelHeight = 0.04
const geom = {
  ...createCube(),
  instanceOffsets: {
    data: rects.map((rect) => {
      return [
        rect[0] + rect[2] / 2,
        levelHeight * (rect[4] + 0.5),
        rect[1] + rect[3] / 2
      ]
    }),
    divisor: 1
  },
  instanceScales: {
    data: rects.map((rect) => {
      // return [rect[2] * Math.pow(0.9, rect[4]), levelHeight, rect[3] * Math.pow(0.9, rect[4])]
      return [rect[2], levelHeight, rect[3]]
    }),
    divisor: 1
  },
  instanceColors: {
    data: rects.map((rect, i) => {
      // return fromHSL(0.5 + random.float(0.1), 0.4, 0.4)
      if (random.chance(0.9)) return [1, 1, 1, 1]
      // if (random.chance(0.6)) return dutchPalette[1]
      // return dutchPalette[i % 12]
      // return dutchPalette[(8 + rect[4] * 2) % dutchPalette.length]
      // return dutchPalette[0 + rect[4] % 8]
      return random.element(dutchPalette)
    }),
    divisor: 1
  },
  instances: rects.length
}
const geomEnt = renderer.entity([
  renderer.transform(),
  renderer.geometry(geom),
  renderer.material({
    receiveShadows: true,
    castShadows: true,
    baseColor: [1, 1, 1, 1],
    metallic: 0,
    roughness: 0.2
    // frag: renderer.shaders.pipeline.material.frag.replace('gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);',
    // `
    // color = vec3(ao);
    // gl_FragData[0] = encode(vec4(color, 1.0), uOutputEncoding);
    // `)
  })
])
renderer.add(geomEnt)
console.log(quat)
const lightEnt = renderer.entity([
  renderer.transform({
    position: [1, 2, 3],
    rotation: quat.fromTo(
      quat.create(),
      [0, 0, 1],
      vec3.normalize([-5, -2, -3])
    )
  }),
  renderer.directionalLight({
    color: [1, 1, 1, 1],
    intensity: 2,
    castShadows: true,
    bias: 0.01
  })
])
renderer.add(lightEnt)

var numLights = 1
for (var i = 0; i < numLights; i++) {
  var a = ((Math.PI * 2) / numLights) * i
  var x = Math.cos(a)
  var y = 2
  var z = Math.sin(a)

  const lightEnt = renderer.entity([
    renderer.transform({
      position: [x, y, z],
      rotation: quat.fromTo(
        quat.create(),
        [0, 0, 1],
        vec3.normalize([-x, -y, -z])
      )
    }),
    renderer.directionalLight({
      color: [1, 1, 1, 1],
      intensity: 1,
      castShadows: true,
      bias: 0.01
    })
  ])
  renderer.add(lightEnt)
}

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

ctx.frame(() => {
  renderer.draw()

  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
