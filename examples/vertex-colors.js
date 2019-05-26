const createRenderer = require('../')
const createContext = require('pex-context')
const createCube = require('primitive-cube')

const ctx = createContext()

const renderer = createRenderer({
  ctx: ctx
})

const camera = renderer.entity([
  renderer.camera({
    fov: Math.PI / 2,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
  }),
  renderer.orbiter({ position: [0, 0, 3] })
])
renderer.add(camera)

const geometry = createCube()
geometry.vertexColors = geometry.uvs.map((uv) => [...uv, 0, 0.5])

const skyboxEntity = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1]
  })
])
renderer.add(skyboxEntity)

const reflectionProbeEntity = renderer.entity([renderer.reflectionProbe()])
renderer.add(reflectionProbeEntity)

const cubeEntity = renderer.entity([
  renderer.geometry(geometry),
  renderer.material({
    baseColor: [1, 1, 1, 0.5],
    // or
    // useSpecularGlossinessWorkflow: true,
    // diffuse: [1, 1, 1, 0.5],
    // glossiness: 0,
    // or
    // unlit: true,
    depthWrite: false,
    blend: true,
    blendSrcRGBFactor: ctx.BlendFactor.SrcAlpha,
    blendSrcAlphaFactor: ctx.BlendFactor.One,
    blendDstRGBFactor: ctx.BlendFactor.OneMinusSrcAlpha,
    blendDstAlphaFactor: ctx.BlendFactor.One
  })
])
renderer.add(cubeEntity)

const ambientLightEntity = renderer.entity([renderer.ambientLight()])
renderer.add(ambientLightEntity)

ctx.frame(() => {
  renderer.draw()
  window.dispatchEvent(new CustomEvent('pex-screenshot'))
})
