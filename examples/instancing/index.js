const mat4 = require('pex-math/mat4')
const quat = require('pex-math/quat')
const vec3 = require('pex-math/vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const Renderer = require('../../')
const createCube = require('primitive-cube')
const createSphere = require('primitive-sphere')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const remap = require('pex-math/utils').map
const cosineGradient = require('cosine-gradient')
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const scheme = [[0.650, 0.500, 0.310], [-0.650, 0.500, 0.600], [0.333, 0.278, 0.278], [0.660, 0.000, 0.667]]
const scheme2 = [[0.500, 0.500, 0.000], [0.500, 0.500, 0.000], [0.100, 0.500, 0.000], [0.000, 0.000, 0.000]]
const gradient = cosineGradient(scheme)
const gradient2 = cosineGradient(scheme2)

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: mat4.create(),
  rotationMat: mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

random.seed(10)

const renderer = new Renderer(ctx, ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight)

const gui = createGUI(ctx)

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 3, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  renderer.add(renderer.entity([
    renderer.camera({
      fov: Math.PI / 3,
      aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
      near: 0.1,
      far: 100
    }),
    renderer.orbiter({ position: [3, 3, 3] })
  ]))
}

function initMeshes () {
  const n = 15
  const cube = createCube(0.75 * 2 / n)
  const offsets = []
  const colors = []
  const scales = []
  const rotations = []

  let time = 0
  var geometry = renderer.geometry({
    positions: cube.positions,
    normals: cube.normals,
    cells: cube.cells,
    uvs: cube.uvs,
    offsets: { data: offsets, divisor: 1 },
    scales: { data: scales, divisor: 1 },
    rotations: { data: rotations, divisor: 1 },
    colors: { data: colors, divisor: 1}
  })
  function update () {
    time += 1 / 60
    const center = [0.75, 0.75, 0.75]
    const radius = 1.25

    const center2 = [-0.75, -0.75, 0.75]
    const radius2 = 1.25

    center[0] = 1.15 * Math.sin(time)
    center[1] = 0.75 * Math.cos(time)

    center2[0] = -1.15 * Math.sin(time)
    center2[1] = 0.75 * Math.sin(time)
    center2[2] = 0.5 * Math.cos(time * 2) * Math.sin(time / 2)

    let i = 0
    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          const pos = [
            remap(x, 0, n, -1, 1),
            remap(y, 0, n, -1, 1),
            remap(z, 0, n, -1, 1)
          ]
          const dist = vec3.distance(pos, center)
          if (dist < radius) {
            const force = vec3.sub(vec3.copy(pos), center)
            vec3.normalize(force)
            vec3.scale(force, 1 - Math.sqrt(dist / radius))
            vec3.add(pos, force)
          }
          const dist2 = vec3.distance(pos, center2)
          if (dist2 < radius2) {
            const force = vec3.sub(vec3.copy(pos), center2)
            vec3.normalize(force)
            vec3.scale(force, 1 - Math.sqrt(dist2 / radius2))
            vec3.add(pos, force)
          }
          offsets[i] = pos
          const value = Math.min(1, dist / radius)
          const value2 = Math.min(1, dist2 / radius2)
          const colorBase = [0.8, 0.1, 0.1, 1.0]
          const color = gradient(value)
          const color2 = gradient2(value2)
          vec3.lerp(colorBase, [0, 0, 0, 0], Math.sqrt(Math.max(0.01, 1 - value - value2)))
          vec3.lerp(color, [0, 0, 0, 0], value)
          vec3.lerp(color2, [0, 0, 0, 0], value2)
          vec3.add(colorBase, color)
          vec3.add(colorBase, color2)
          colors[i] = colorBase
          scales[i] = [1, 1, 4]
          const dir = vec3.normalize(vec3.sub(vec3.copy(pos), center))
          rotations[i] = quat.fromTo(quat.create(), [0, 0, 1], dir)
          i++
        }
      }
    }

    geometry.set({
      offsets: offsets,
      scales: scales,
      rotations: rotations,
      colors: colors,
      instances: offsets.length
    })
  }
  update()
  setInterval(update, 1000 / 60)
  const entity = renderer.entity([
    renderer.transform({
      position: [0, 0, 0]
    }),
    geometry,
    renderer.material({
      baseColor: [0.9, 0.9, 0.9, 1],
      roughness: 0.01,
      metallic: 1.0,
      castShadows: true,
      receiveShadows: true
    })
  ])
  renderer.add(entity)

  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    entity.getComponent('Material').set({ roughness: State.roughness })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    entity.getComponent('Material').set({ metallic: State.metallic })
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    entity.getComponent('Material').set({ baseColor: State.baseColor })
  })
}

function initSky () {
  const sun = State.sun = renderer.directionalLight({
    direction: vec3.sub(vec3.create(), State.sunPosition),
    color: [5, 5, 4, 1],
    bias: 0.01,
    castShadows: true
  })
  gui.addTexture2D('Shadow map', sun._shadowMap).setPosition(10 + 170, 10)

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition
  })
  gui.addTexture2D('Sky', skybox._skyTexture)

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })
  gui.addTexture2D('ReflectionMap', reflectionProbe._reflectionMap)

  renderer.add(renderer.entity([ sun ]))
  renderer.add(renderer.entity([ skybox ]))
  renderer.add(renderer.entity([ reflectionProbe ]))
}

function initLights () {
  gui.addTexture2D('Shadow Map', renderer._sunLightNode.data.light._shadowMap)
  const sphereMesh = buildMesh(createSphere(0.2))
  var pointLight = renderer.createNode({
    mesh: sphereMesh,
    position: [0, 2, -5],
    material: {
      baseColor: [0, 0, 0, 1],
      emissiveColor: [1, 1, 1, 1]
    },
    light: {
      type: 'point',
      position: [0, 1, -3],
      color: [1, 1, 1, 1],
      radius: 20
    }
  })
  // renderer.add(pointLight)

  var areaLightMesh = buildMesh(createCube(1))
  var areaLightColor = [1, 1, 1, 1]
  var areaLightNode = renderer.createNode({
    enabled: true,
    position: [0, 0, 0],
    scale: [0.5, 0.5, 0.1],
    rotation: quat.fromDirection(quat.create(), [0, 0, 1]),
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
  // renderer.add(areaLightNode)
}

initCamera()
initMeshes()
// initLights()
initSky()

let frameNumber = 0
let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

ctx.frame(() => {
  ctx.debug(frameNumber++ < 2 || debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
