const Mat4 = require('pex-math/Mat4')
const Quat = require('pex-math/Quat')
const Vec3 = require('pex-math/Vec3')
const createCamera = require('pex-cam/perspective')
const createOrbiter = require('pex-cam/orbiter')
const createRenderer = require('../../')
const createRoundedCube = require('primitive-rounded-cube')
const createSphere = require('primitive-sphere')
const createCapsule = require('primitive-capsule')
const createCube = require('primitive-cube')
const createGUI = require('pex-gui')
const random = require('pex-random')
const createContext = require('pex-context')
const io = require('pex-io')
const isBrowser = require('is-browser')
const dragon = require('stanford-dragon/3')
const normals = require('angle-normals')
const centerAndNormalize = require('geom-center-and-normalize')
dragon.positions = centerAndNormalize(dragon.positions).map((v) => Vec3.scale(v, 5))
dragon.normals = normals(dragon.cells, dragon.positions)
dragon.uvs = dragon.positions.map(() => [0, 0])

const parseHdr = require('./local_modules/parse-hdr')
const ctx = createContext()
ctx.gl.getExtension('EXT_shader_texture_lod')
ctx.gl.getExtension('OES_standard_derivatives')
ctx.gl.getExtension('WEBGL_draw_buffers')
ctx.gl.getExtension('OES_texture_float')

const State = {
  sunPosition: [0, 5, -5],
  elevation: 65,
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

const renderer = createRenderer({
  ctx: ctx,
  profile: true,
  shadowQuality: 3
})

const gui = createGUI(ctx)
gui.addHeader('Sun')
gui.addParam('Sun Elevation', State, 'elevation', { min: -90, max: 180 }, updateSunPosition)
gui.addParam('Sun Azimuth', State, 'azimuth', { min: -180, max: 180 }, updateSunPosition)
gui.addHeader('Postprocess')
gui.addParam('Expsure', renderer._state, 'exposure')
gui.addParam('Postprocess', renderer._state, 'postprocess')
gui.addParam('DOF', renderer._state, 'dof')
gui.addParam('DOF Iterations', renderer._state, 'dofIterations', { min: 1, max: 5, step: 1 })
gui.addParam('DOF Depth', renderer._state, 'dofDepth', { min: 0, max: 20 })
gui.addParam('DOF Range', renderer._state, 'dofRange', { min: 0, max: 20 })
gui.addParam('DOF Radius', renderer._state, 'dofRadius', { min: 0, max: 20 })
gui.addParam('SSAO', renderer._state, 'ssao')
gui.addParam('SSAO radius', renderer._state, 'ssaoRadius', { min: 0, max: 30 })
gui.addParam('SSAO intensity', renderer._state, 'ssaoIntensity', { min: 0, max: 10 })
gui.addParam('SSAO bias', renderer._state, 'ssaoBias', { min: 0, max: 1 })
gui.addParam('BilateralBlur', renderer._state, 'bilateralBlur')
gui.addParam('BilateralBlur radius', renderer._state, 'bilateralBlurRadius', { min: 0, max: 5 })

function updateSunPosition () {
  Mat4.setRotation(State.elevationMat, State.elevation / 180 * Math.PI, [0, 0, 1])
  Mat4.setRotation(State.rotationMat, State.azimuth / 180 * Math.PI, [0, 1, 0])

  Vec3.set3(State.sunPosition, 10, 0, 0)
  Vec3.multMat4(State.sunPosition, State.elevationMat)
  Vec3.multMat4(State.sunPosition, State.rotationMat)

  if (State.sun) {
    var sunDir = State.sun.direction
    Vec3.set(sunDir, [0, 0, 0])
    Vec3.sub(sunDir, State.sunPosition)
    State.sun.set({ direction: sunDir })
  }

  if (State.skybox) {
    State.skybox.set({ sunPosition: State.sunPosition })
  }

  if (State.reflectionProbe) {
    State.reflectionProbe.dirty = true // FIXME: hack
  }
}

// gui.addParam('Exposure', renderer._state, 'exposure', { min: 0.01, max: 5 })
// gui.addParam('Shadow Bias', renderer._state, 'bias', { min: 0.001, max: 0.1 })
// gui.addParam('SSAO', renderer._state, 'ssao')
// gui.addParam('SSAO Sharpness', renderer._state, 'ssaoSharpness', { min: 0, max: 100 })
// gui.addParam('SSAO Radius', renderer._state, 'ssaoRadius', { min: 0, max: 1 })

function initCamera () {
  const camera = createCamera({
    fov: Math.PI / 3,
    aspect: ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight,
    position: [0, 1, 10],
    target: [0, 0, 0],
    near: 0.1,
    far: 100
  })
  createOrbiter({ camera: camera })

  renderer.entity([
    renderer.camera({ camera: camera })
  ])
}

function initMeshes () {
  const groundCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.01)
  const roundedCube = createRoundedCube(1, 1, 1, 20, 20, 20, 0.2)
  const capsule = createCapsule(0.3)
  const sphere = createSphere(0.5)
  const geometries = [capsule, roundedCube, sphere]
  const entities = []


  random.seed(14)
  for (var i = 0; i < 20; i++) {
    renderer.entity([
      renderer.transform({
        position: Vec3.scale(random.vec3(), 2)
      }),
      renderer.geometry(sphere),
      renderer.material({
        baseColor: [0.7, 0.7, 0.7, 1.0],
        roughness: 1,
        metallic: 0
      })
    ])
  }

  renderer.entity([
    renderer.transform({
      position: [0, -2.2, 0],
      scale: [20, 0.2, 7]
    }),
    renderer.geometry(groundCube),
    renderer.material({
      baseColor: [0.15, 0.15, 0.2, 1.0],
      roughness: 1,
      metallic: 0
    })
  ])

  const dragonEnt = renderer.entity([
    renderer.transform({
      position: [0, -0.4, 2]
    }),
    renderer.geometry(dragon),
    renderer.material({
      baseColor: [0.8, 0.8, 0.8, 1.0],
      roughness: 1,
      metallic: 0
    })
  ])
  entities.push(dragonEnt)

  let materialIndex = 0
  for (let j = -5; j <= 5; j += 2) {
    for (let i = 0; i < geometries.length; i++) {
      const geom = geometries[i]
      const x = j
      const y = 1.5 * (1 - i)
      const z = 0
      const entity = renderer.entity([
        renderer.transform({
          position: [x, y, z]
        }),
        renderer.geometry(geom),
        renderer.material({
          baseColor: [0.9, 0.9, 0.9, 1],
          baseColorMap: materialIndex ? State.materials[materialIndex].baseColorTex : null,
          roughness: (j + 5) / 10,
          roughnessMap: materialIndex ? State.materials[materialIndex].roughnessTex : null,
          metallic: 0.0, // 0.01, // (j + 5) / 10
          metallicMap: materialIndex ? State.materials[materialIndex].metallicTex : null,
          normalMap: materialIndex ? State.materials[materialIndex].normalTex : null
        })
      ])
      entities.push(entity)
    }
    materialIndex = (materialIndex + 1) % State.materials.length
  }
  gui.addHeader('Material')
  gui.addParam('Roughness', State, 'roughness', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ roughness: State.roughness }) })
  })
  gui.addParam('Metallic', State, 'metallic', {}, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ metallic :State.metallic }) })
  })
  gui.addParam('Base Color', State, 'baseColor', { type: 'color' }, () => {
    entities.forEach((entity) => { entity.getComponent('Material').set({ baseColor: State.baseColor }) })
  })
  gui.addHeader('Tex')
  gui.addTexture2D('Depth', renderer._frameDepthTex)
}

function initSky (panorama) {
  const sun = State.sun = renderer.directionalLight({
    direction: Vec3.sub(Vec3.create(), State.sunPosition),
    color: [1, 1, 0.95, 1],
    intensity: 10
  })

  const skybox = State.skybox = renderer.skybox({
    sunPosition: State.sunPosition,
    // texture: panorama
  })

  // currently this also includes light probe functionality
  const reflectionProbe = State.reflectionProbe = renderer.reflectionProbe({
    origin: [0, 0, 0],
    size: [10, 10, 10],
    boxProjection: false
  })

  renderer.entity([ sun ])
  renderer.entity([ skybox ])
  renderer.entity([ reflectionProbe ])
}

function initLights () {
  const pointLight1 = renderer.entity([
    renderer.geometry(createSphere(0.2)),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [1, 0, 0, 1]
    }),
    renderer.transform({
      position: [2, 2, 2]
    }),
    renderer.pointLight({
      color: [1, 0, 0, 1],
      intensity: 3,
      radius: 10
    })
  ])

  // const pointLight2 = renderer.entity([
    // renderer.geometry(createSphere(0.2)),
    // renderer.material({
      // baseColor: [0, 0, 0, 1],
      // emissiveColor: [0, 0.5, 1, 1]
    // }),
    // renderer.transform({
      // position: [-2, 2, 2]
    // }),
    // renderer.pointLight({
      // color: [0, 0.5, 1, 1],
      // intensity: 3,
      // radius: 10
    // })
  // ])

  gui.addParam('Light 1 Pos', pointLight1.transform, 'position', { min: -5, max: 5 }, (value) => {
    pointLight1.transform.set({ position: value })
  })

  const areaLight = renderer.entity([
    renderer.geometry(createCube()),
    renderer.material({
      baseColor: [0, 0, 0, 1],
      emissiveColor: [1.0, 0.8, 0.0, 1]
    }),
    renderer.transform({
      position: [0, 0, -3],
      scale: [6, 2, 0.1],
      rotation: Quat.fromDirection(Quat.create(), [1, 0, 1])
    }),
    renderer.areaLight({
      color: [1.0, 0.8, 0.0, 1],
      intensity: 2
    })
  ])
  gui.addParam('Area Light 1 Col', areaLight.getComponent('AreaLight'), 'color', { type: 'color' }, (value) => {
    areaLight.getComponent('AreaLight').set({ color: value })
    areaLight.getComponent('Material').set({ emissiveColor: value })
  })
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

const ASSETS_DIR = isBrowser ? 'http://localhost/assets' : '/Users/vorg/Workspace/assets'

function initMaterials () {
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
  baseColorTextures = baseColorTextures.slice(46, 50)
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
}

function imageFromFile (file, options) {
  const tex = ctx.texture2D({ width: 1, height: 1})
  io.loadImage(file, function (err, image) {
    console.log('image loaded', file)
    if (err) console.log(err)
    ctx.update(tex, {
      data: image,
      width: image.width,
      height: image.height,
      wrap: ctx.Wrap.Repeat,
      flipY: true,
      min: ctx.Filter.Linear,
      mag: ctx.Filter.LinearMipmapLinear
    })
    ctx.update(tex, { mipmap: true })
    // tex(Object.assign(canvasToPixels(image), {
      // min: 'mipmap',
      // mag: 'linear',
      // wrap: 'repeat'
    // }))
  }, true)
  return tex
}

initMaterials()
initCamera()
initMeshes()
// io.loadBinary('http://localhost/assets/envmaps/grace-new/grace-new.hdr', (err, buf) => {
// io.loadBinary('http://localhost/assets/envmaps/garage/garage.hdr', (err, buf) => {
// io.loadBinary('http://192.168.1.123/assets/envmaps/OpenfootageNET_Salzach_low.hdr', (err, buf) => {
// io.loadBinary('http://192.168.1.123/assets/envmaps/multi-area-light/multi-area-light.hdr', (err, buf) => {
io.loadBinary('http://192.168.1.123/assets/envmaps/hallstatt4_hd.hdr', (err, buf) => {
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
// initSky()
initLights()

let frameNumber = 0
let debugOnce = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'd') debugOnce = true
})

updateSunPosition()

ctx.frame(() => {
  ctx.debug(debugOnce)
  debugOnce = false
  renderer.draw()

  gui.draw()
})
