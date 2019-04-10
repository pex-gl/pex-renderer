const path = require('path')
const createRenderer = require('..')
const createContext = require('pex-context')
const io = require('pex-io')
const GUI = require('pex-gui')
const { quat, mat4 } = require('pex-math')
const createSphere = require('primitive-sphere')
const parseHdr = require('parse-hdr')
const isBrowser = require('is-browser')

const ctx = createContext()
const renderer = createRenderer(ctx)
const gui = new GUI(ctx)

const ASSETS_DIR = isBrowser ? 'assets' : path.join(__dirname, 'assets')
const gridSize = 5

const State = {
  clearCoat: true
}

const camera = renderer.entity([
  renderer.transform({ position: [0, 0, 3] }),
  renderer.camera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    near: 0.1,
    far: 100
  }),
  renderer.orbiter({
    position: [0, 0, gridSize * 1.3]
  })
])
renderer.add(camera)

const geometry = createSphere(0.4)
const materialProperties = {
  baseColor: [1, 1, 1, 1],
  roughness: 0.8,
  metallic: 1,
  clearCoatNormalMapScale: 1,
  // castShadows: true,
  // receiveShadows: true
}

const directionalLightEntity = renderer.entity([
  renderer.transform({
    position: [1, 1, 1],
    rotation: quat.fromMat4(quat.create(), mat4.lookAt(mat4.create(), [1, 1, 0], [0, 0, 0], [0, 1, 0]))
  }),
  renderer.directionalLight({
    color: [1, 0, 0, 1],
    intensity: 2,
    castShadows: true
  }),
  // renderer.geometry(createSphere(0.1)),
  // renderer.material({ baseColor: [1, 0, 0, 1] })
])
renderer.add(directionalLightEntity)

const pointLightEntity = renderer.entity([
  renderer.transform({
    position: [0, 0, 1.3 * gridSize / 2],
  }),
  renderer.pointLight({
    color: [0, 1, 0, 1],
    intensity: 2,
    castShadows: true
  }),
  // renderer.geometry(createSphere(0.1)),
  // renderer.material({ baseColor: [0, 1, 0, 1] })
])
renderer.add(pointLightEntity)

const spotLightEntity = renderer.entity([
  renderer.transform({
    position: [0, 1.3 * gridSize / 2, 0],
    rotation: quat.fromMat4(quat.create(), mat4.lookAt(mat4.create(), [-1, -1, -1], [0, 0, 0], [0, 1, 0]))
  }),
  renderer.spotLight({
    color: [0, 0, 1, 1],
    intensity: 10,
    innerAngle: 0,
    angle: Math.PI / 4,
    castShadows: true
  }),
  // renderer.geometry(createSphere(0.1)),
  // renderer.material({ baseColor: [0, 0, 1, 1] })
])
renderer.add(spotLightEntity)

const skybox = renderer.entity([
  renderer.skybox({
    sunPosition: [1, 1, 1],
    backgroundBlur: 1
  })
])
renderer.add(skybox)

const reflectionProbe = renderer.entity([
  renderer.reflectionProbe()
])
renderer.add(reflectionProbe)

function getMaterialMaps (maps) {
  return Object.entries(maps).reduce(
    (currentValue, [key, image]) => ({
      ...currentValue,
      [key]: ctx.texture2D({
        data: image,
        width: 256,
        height: 256,
        min: ctx.Filter.LinearMipmapLinear,
        mag: ctx.Filter.Linear,
        flipY: true,
        mipmap: true,
        ...(key === 'emissiveColorMap' || key === 'baseColorMap'
          ? ctx.Encoding.SRGB
          : ctx.Encoding.Linear)
      })
    }),
    {}
  )
}

;(async () => {
  const baseColorMap = await io.loadImage(`${ASSETS_DIR}/plastic-green.material/plastic-green_basecolor.png`)
  const normalMap = await io.loadImage(`${ASSETS_DIR}/plastic-green.material/plastic-green_n.png`)
  const metallicMap = await io.loadImage(`${ASSETS_DIR}/plastic-green.material/plastic-green_metallic.png`)
  const roughnessMap = await io.loadImage(`${ASSETS_DIR}/plastic-green.material/plastic-green_roughness.png`)
  const clearCoatNormalMap = await io.loadImage(`${ASSETS_DIR}/orange-peel-normal.jpg`)

  const maps = getMaterialMaps({
    baseColorMap,
    normalMap,
    metallicMap,
    roughnessMap,
    // clearCoatNormalMap
  })

  const spheresEntities = []
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        const clearCoatProperties = {
          clearCoat: x / (gridSize - 1),
          clearCoatRoughness: 0.8 * y / (gridSize - 1),
          reflectance: z / (gridSize - 1)
        }
        const coatedSphereEntity = renderer.entity([
          renderer.transform({
            position: [x - (gridSize - 1) * 0.5, y - (gridSize - 1) * 0.5, z - (gridSize - 1) * 0.5]
          }),
          renderer.geometry(geometry),
          renderer.material({
            ...materialProperties,
            ...maps,
            ...clearCoatProperties
          })
        ])
        coatedSphereEntity.clearCoatProperties = clearCoatProperties
        spheresEntities.push(coatedSphereEntity)
        renderer.add(coatedSphereEntity)
      }
    }
  }

  const buffer = await io.loadBinary(`${ASSETS_DIR}/garage.hdr`)
  const hdrImg = parseHdr(buffer)
  const panorama = ctx.texture2D({
    data: hdrImg.data,
    width: hdrImg.shape[0],
    height: hdrImg.shape[1],
    pixelFormat: ctx.PixelFormat.RGBA32F,
    encoding: ctx.Encoding.Linear,
    flipY: true
  })

  skybox.getComponent('Skybox').set({ texture: panorama })
  reflectionProbe.getComponent('ReflectionProbe').set({ dirty: true })

  gui.addHeader('Clear coat')
  gui.addParam('enabled', State, 'clearCoat', {}, (value) => {
    if (value) {
      spheresEntities.forEach(sphere => sphere.getComponent('Material').set(sphere.clearCoatProperties))
    } else {
      spheresEntities.forEach(sphere => sphere.getComponent('Material').set({ clearCoat: null, clearCoatRoughness: null }))
    }
  })
})()

ctx.frame(() => {
  renderer.draw()
  gui.draw()
})
