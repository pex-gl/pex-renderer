const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const Renderer = require('../../Renderer')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const parseHdr = require('./local_modules/parse-hdr')

// const ctx = createContext({ powerPreference: 'high-performance' })
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const State = {
  sunPosition: [-5, 5, -5],
  elevation: 45,
  azimuth: -45,
  mie: 0.000021,
  elevationMat: Mat4.create(),
  rotationMat: Mat4.create(),
  roughness: 0.5,
  metallic: 0.1,
  baseColor: [0.8, 0.1, 0.1, 1.0],
  materials: []
}

random.seed(10)

const renderer = new Renderer({ ctx: ctx, profile: true, pauseOnBlur: true, backgroundColor: [1, 0, 0, 1] })

const gui = createGUI(ctx)
gui.toggleEnabled()
gui.addHeader('Settings')
gui.addParam('New PBR', renderer._state, 'useNewPBR')
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(State.sunPosition, 10, 0, 0)
  Vec3.multMat4(State.sunPosition, State.elevationMat)
  Vec3.multMat4(State.sunPosition, State.rotationMat)

  if (State.sunNode) {
    var sunDir = State.sunNode.data.light.direction
    State.sunNode.setPosition(State.sunPosition)
    Vec3.set(sunDir, [0, 0, 0])
    Vec3.sub(sunDir, State.sunPosition)
  }

  if (State.skyboxNode) {
    State.skyboxNode.data.skybox._skyEnvMapTex.setSunPosition(State.sunPosition)
  }

  // todo, update nodes
}

gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 3, 8],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })

  var cameraNode = renderer.createNode({
    camera: camera
  })
  renderer.add(cameraNode)

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

function initMeshes () {
  const roundedCubeMesh = buildMesh(createRoundedCube(1, 1, 1, 20, 20, 20, 0.2))
  const capsuleMesh = buildMesh(createCapsule(0.3))
  const sphereMesh = buildMesh(createSphere(0.5))
  // const meshes = [capsuleMesh, roundedCubeMesh, sphereMesh]
  const meshes = [roundedCubeMesh]
  const nodes = []
  var ground = renderer.createNode({
    position: [0, -2.2, 0],
    scale: [20, 0.2, 20],
    mesh: roundedCubeMesh,
    material: {
      baseColor: [0.15, 0.15, 0.2, 1.0],
      roughness: 1,
      metallic: 0
    }
  })
  renderer.add(ground)

  var materialIndex = 0
  for (var j = 0;  j < 25; j += 1) {
    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i]
      const x = (j % 5) * 2
      const y = 1.5 * (1 - i)
      const z = ((j / 5) | 0) * 2
      const node = renderer.createNode({
        mesh: mesh,
        position: [x, y, z],
        material: {
          baseColor: [0.9, 0.9, 0.9, 1],
          baseColorMap: State.materials[materialIndex].baseColorTex,
          roughness:  (j + 5) / 10,
          roughnessMap: State.materials[materialIndex].roughnessTex,
          metallic: 0.01, // (j + 5) / 10
          metallicMap: State.materials[materialIndex].metallicTex,
          normalMap: State.materials[materialIndex].normalTex
        }
      })
      nodes.push(node)
      renderer.add(node)
    }
    materialIndex = (materialIndex + 1) % State.materials.length
  }
  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    nodes.forEach((node) => { node.data.material.roughness = State.roughness })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    nodes.forEach((node) => { node.data.material.metallic = State.metallic })
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    nodes.forEach((node) => { node.data.material.baseColor = State.baseColor })
  })
}

function initLights () {
  var sunDir = Vec3.normalize([1, -1, 1])

  const sphereMesh = buildMesh(createSphere(0.2))
  var pointLight = renderer.createNode({
    mesh: sphereMesh,
    position: [-2, 2, 2],
    material: {
      baseColor: [1, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    },
    light: {
      type: 'point',
      position: [-2, 2, 2],
      color: [1, 0, 0, 1],
      radius: 50
    }
  })
  renderer.add(pointLight)

  var areaLightMesh = buildMesh(createCube(1))
  var areaLightColor = [1, 2, 2, 1]
  var areaLightNode = renderer.createNode({
    enabled: true,
    position: [6, 0, 0],
    scale: [1, 10, 0.1],
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
  // gui.addParam('AreaLight Size', areaLightNode.data, 'scale', { min: 0, max: 5 }, (value) => {
    // areaLightNode.setScale(value[0], value[1], value[2])
  // })
  // gui.addParam('AreaLight Intensity', areaLightNode.data.light, 'intensity', { min: 0, max: 5 })
  // gui.addParam('AreaLight', areaLightNode.data.light, 'color', { type: 'color' })
  // renderer.add(areaLightNode)
}

function imageFromFile (file, options) {
  let tex = ctx.texture2D({ width: 1, height: 1})
  io.loadImage(file, function (err, image) {
    console.log('image loaded', file)
    if (err) console.log(err)
    ctx.update(tex, { data: image, wrap: ctx.Wrap.Repeat, flipY: true, min: ctx.Filter.Linear, mag: ctx.Filter.LinearMipmapLinear })
    ctx.update(tex, { mipmap: true })
    // tex(Object.assign(canvasToPixels(image), {
      // min: 'mipmap',
      // mag: 'linear',
      // wrap: 'repeat'
    // }))
  }, true)
  return tex
}

var files = `Brick_AssortedMedievalBrick_PBR_Metallic
Concrete_ChunkybrokenWall_PBR_Metallic
Concrete_ClayWithBrokenRubble_PBR_Metallic
Concrete_MicroCrackWall_PBR_Metallic
Concrete_OldCitySidewalk_PBR_Metallic
Concrete_SmoothChipped_PBR_Metallic
Concrete_StripedConcrete_PBR_Metallic
Fabric_BasketWeaveCotton_PBR_Metallic
Ground_CleanStreetConcrete_PBR_Metallic
Ground_DrivewayConcrete_PBR_Metallic
Ground_FineStones_PBR_Metallic
Ground_SandyConcreteWithPebbles_PBR_Metallic
Leather_CarLeather_PBR_Metallic
Leather_ChesterfieldLeatherSofa_PBR_Metallic
Leather_JerkyLeather_PBR_Metallic
Leather_Plain_PBR_Metallic
Leather_RoughBumpyLeather_PBR_Metallic
Leather_ScratchyWrinkledLeather_PBR_Metallic
Marble_CelticGoldAndMarbleFloor_PBR_Metallic
Metal_AgedBrass_PBR_Metallic
Metal_CleanPaintedWithChips_PBR_Metallic
Metal_CorrodedSteel_PBR_Metallic
Metal_DamagedIron_PBR_Metallic
Metal_DerelictResearchVessel_PBR_Metallic
Metal_LongMetalTiles_PBR_Metallic
Metal_PaintedWeatheredMetal_PBR_Metallic
Metal_SciFiMetalWithBars_PBR_Metallic
Metal_SciFiMetalWithCircles_PBR_Metallic
Metal_SciFiMetalWithIndustrialPattern_PBR_Metallic
Metal_SciFiMetalWithSquares_PBR_Metallic
Metal_SmoothBrushedSteel_PBR_Metallic
Misc_BlackLeather_PBR_Metallic
Misc_DeepOceanWaves_PBR_Metallic
Misc_PersianRug_PBR_Metallic
Misc_RadarDome_PBR_Metallic
Misc_StylizedWater_PBR_Metallic
Rock_CrackingLayerWall_PBR_Metallic
Rock_CrumblingCaveStone_PBR_Metallic
Rock_QuarryStone_PBR_Metallic
Rock_RawFlint_PBR_Metallic
Rock_Scoria_PBR_Metallic
Rock_SharpCrumblingCliff_PBR_Metallic
Rubber_SciFiRubberWithTriangles_PBR_Metallic
Sci-Fi_SciFiFloorSet_PBR_Metallic
Sci-Fi_SciFiMonitorsSetAbandoned_PBR_Metallic
Sci-Fi_SciFiWallSet_PBR_Metallic
Tile_BrokenOldTiling_PBR_Metallic
Tile_InterlockedCircleSquareGold_PBR_Metallic
Tile_NastyOld_PBR_Metallic
Wood_DistressedWood_PBR_Metallic
Wood_EbonyRiftCut_PBR_Metallic
Wood_FineWalnut_PBR_Metallic
Wood_LongWideFloorPlanks_PBR_Metallic
Wood_OakVeneer_PBR_Metallic
Wood_OldKnotty_PBR_Metallic
Wood_OldPineBark_PBR_Metallic
Wood_PatchedPlywood_PBR_Metallic
Wood_RandomLongPlanks_PBR_Metallic
Wood_SharpGrainyWood_PBR_Metallic
Wood_TropicalHardwood_PBR_Metallic
brick_MedievalBrickSlop_PBR_Metallic
brick_houseBricksDamaged_PBR_Metallic
ground_ForestCoverPolygonStone_PBR_Metallic
ground_PebblesAndGrass_PBR_Metallic
ground_SoilAndGravel_PBR_Metallic
ground_SquarePaversOnGrass_PBR_Metallic
wall_GenericBrownStucco_PBR_Metallic
wood_OldWideFloorPlanks_PBR_Metallic`

function initMaterials () {
  const ASSETS_DIR = isBrowser ? 'http://192.168.1.123/assets' : '/Users/vorg/Workspace/assets'
  let baseColorTextures = [
    // ASSETS_DIR + '/gametextures_metallic/Sci-Fi_SciFiWallSet_PBR_Metallic/Sci-Fi_SciFiWallSet_2k_basecolor.png',
    // ASSETS_DIR + '/gametextures_metallic/Metal_DamagedIron_PBR_Metallic/Metal_DamagedIron_2k_basecolor.png',
    // ASSETS_DIR + '/gametextures_metallic/Misc_RadarDome_PBR_Metallic/Misc_RadarDome_2k_basecolor.png',
    // ASSETS_DIR + '/gametextures_metallic/Marble_CelticGoldAndMarbleFloor_PBR_Metallic/Marble_CelticGoldAndMarbleFloor_2k_basecolor.png',
    // ASSETS_DIR + '/gametextures_metallic/Tile_InterlockedCircleSquareGold_PBR_Metallic/Tile_InterlockedCircleSquareGold_2k_basecolor.png',
    // ASSETS_DIR + '/gametextures_metallic/Leather_ChesterfieldLeatherSofa_PBR_Metallic/Leather_ChesterfieldLeatherSofa_2k_basecolor.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Brick_DustyRedSeattle_PBR/Brick_DustyRedSeattle_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_FloorPanelModularPainted_pbr/Metal_FloorPanelModularPainted_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_MatiasSciFiCieling/Metal_MatiasSciFiCieling_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_PaintedWeatheredMetal/Metal_PaintedWeatheredMetal_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_SciFiCompartmentPanels_PBR/Metal_SciFiCompartmentPanels_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_SciFiFlatPlatingSquare_pbr/Metal_SciFiFlatPlatingSquare_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_ScifiTrimPieces_PBR/Metal_ScifiTrimPieces_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Metal_SteelOxidized_PBR/Metal_SteelOxidized_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Misc_BlackLeather_PBR/Misc_BlackLeather_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Vorg_Var_Plastic/Vorg_Var_Plastic_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Vorg_White_Base/Vorg_White_Base_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Wood_LongWideFloorPlanks/Wood_LongWideFloorPlanks_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Wood_OakBaseAged/Wood_OakBaseAged_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/Wood_RailwaySleeper/Wood_RailwaySleeper_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/ground_lavaflow_pbr/ground_lavaflow_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/metal_DiamondPlateFloor_PBR/metal_DiamondPlateFloor_Base_Color.png',
    // ASSETS_DIR + '/textures/gametextures_old_met/tile_disgustingtilev2_PBR/tile_disgustingtilev2_Base_Color.png'
  ]
  baseColorTextures = files.split('\n').map((dir) => {
    var file = dir.replace('PBR_Metallic', '2k_basecolor.png')
    return ASSETS_DIR + `/gametextures_metallic/${dir}/${file}`
  })
  baseColorTextures = baseColorTextures.slice(0, 30)
  for (let i = 0; i < baseColorTextures.length; i++) {
    const mat = {}
    mat.baseColorTex = imageFromFile(baseColorTextures[i], { flip: false, mipmap: true, repeat: true })
    mat.normalTex = imageFromFile(baseColorTextures[i].replace('_basecolor.', '_n.'), { flipY: true, mipmap: true, repeat: true })
    mat.roughnessTex = imageFromFile(baseColorTextures[i].replace('_basecolor.', '_roughness.'), { flipY: true, mipmap: true, repeat: true })
    mat.metallicTex = imageFromFile(baseColorTextures[i].replace('_basecolor.', '_metallic.'), { flipY: true, mipmap: true, repeat: true })
    // mat.normalTex = imageFromFile(baseColorTextures[i].replace('_Base_Color.', '_Normal.'), { flipY: true, mipmap: true, repeat: true })
    // mat.roughnessTex = imageFromFile(baseColorTextures[i].replace('_Base_Color.', '_Roughness.'), { flipY: true, mipmap: true, repeat: true })
    // mat.metallicTex = imageFromFile(baseColorTextures[i].replace('_Base_Color.', '_Metallic.'), { flipY: true, mipmap: true, repeat: true })
    State.materials.push(mat)
  }

  /*
  */
}

function initSky (panorama) {
  var sunNode = State.sunNode = renderer.createNode({
    light: {
      type: 'directional',
      direction: Vec3.sub(Vec3.create(), State.sunPosition),
      color: [5, 5, 4, 1]
    }
  })
  renderer.add(sunNode)

  var skyboxNode = State.skyboxNode = renderer.createNode({
    skybox: {
      sunPosition: State.sunPosition,
      texture: panorama
    }
  })
  renderer.add(skyboxNode)

  // currently this also includes light probe functionality
  var reflectionProbeNode = renderer.createNode({
    reflectionProbe: {
      origin: [0, 0, 0],
      size: [10, 10, 10],
      boxProjection: false
    }
  })
  renderer.add(reflectionProbeNode)

  gui.addTexture2D('ReflectionMap', reflectionProbeNode.data.reflectionProbe._reflectionProbe.getReflectionMap())
  // gui.addTexture2D('Skybox', State.skyboxNode.data.skybox._skyEnvMapTex.texture).setPosition(170 + 10, 10)
  // gui.addTexture2D('Sun depth map', State.sunNode.data.light._shadowMap)
}

initMaterials()

initCamera()
initMeshes()
// initLights()

// io.loadImage('assets/pisa_preview.jpg', (err, img) => {
  // const panorama = ctx.texture2D({ data: img, flipY: true })
  // gui.addTexture2D('Panorama', panorama)
  // initSky(panorama)
// })

io.loadBinary('http://192.168.1.123/assets/envmaps/pisa/pisa.hdr', (err, buf) => {
// io.loadBinary('http://localhost/assets/envmaps/garage/garage.hdr', (err, buf) => {
// io.loadBinary('http://localhost/assets/envmaps/grace-new/grace-new.hdr', (err, buf) => {
  const hdrImg = parseHdr(buf)
  const data = new Uint8Array(hdrImg.data.length)
  for (var i = 0; i < hdrImg.data.length; i+=4) {
    let r = hdrImg.data[i]
    let g = hdrImg.data[i + 1]
    let b = hdrImg.data[i + 2]
    r = 1 / 7 * Math.sqrt(r)
    g = 1 / 7 * Math.sqrt(g)
    b = 1 / 7 * Math.sqrt(b)
    let a = Math.max(r, Math.max(g, b))
    if (a > 1) a = 1
    if (a < 1 / 255) a = 1 / 155
    a = Math.ceil(a * 255) / 255
    r /= a
    g /= a
    b /= a
    data[i] = (r * 255) | 0
    data[i + 1] = (g * 255) | 0
    data[i + 2] = (b * 255) | 0
    data[i + 3] = (a * 255) | 0
  }
  const panoramaRGBM = ctx.texture2D({ data: data, width: hdrImg.shape[0], height: hdrImg.shape[1], /*format: ctx.PixelFormat.RGBA8,*/ flipY: true })
  gui.addTexture2D('Panorama', panoramaRGBM)
  initSky(panoramaRGBM)
})

let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
  if (e.key === 'g') gui.toggleEnabled()
})

updateSunPosition()

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  renderer._state.profiler.time('GUI')
  gui.draw()
  renderer._state.profiler.timeEnd('GUI')
})
