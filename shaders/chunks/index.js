const math = require('./math.glsl.js')

const encodeDecode = require('./encode-decode.glsl.js')
const rgbm = require('./rgbm.glsl.js')
const gamma = require('./gamma.glsl.js')

const lightAmbient = require('./light-ambient.glsl.js')
const lightDirectional = require('./light-directional.glsl.js')
const lightPoint = require('./light-point.glsl.js')
const lightSpot = require('./light-spot.glsl.js')
const lightArea = require('./light-area.glsl.js')

const shadowing = require('./shadowing.glsl.js')
const brdf = require('./brdf.glsl.js')
const clearCoat = require('./clear-coat.glsl.js')
const irradiance = require('./irradiance.glsl.js')
const direct = require('./direct.glsl.js')
const indirect = require('./indirect.glsl.js')

const envMapEquirect = require('./env-map-equirect.glsl.js')
const octMap = require('./oct-map.glsl.js')
const octMapUvToDir = require('./oct-map-uv-to-dir.glsl.js')

const textureCoordinates = require('./texture-coordinates.glsl.js')
const baseColor = require('./base-color.glsl.js')
const tintColor = require('./tint-color.glsl.js')
const emissiveColor = require('./emissive-color.glsl.js')
const alpha = require('./alpha.glsl.js')
const ambientOcclusion = require('./ambient-occlusion.glsl.js')
const normal = require('./normal.glsl.js')

const metallicRoughness = require('./metallic-roughness.glsl.js')
const specularGlossiness = require('./specular-glossiness.glsl.js')

const depthRead = require('./depth-read.glsl.js')
const depthUnpack = require('./depth-unpack.glsl.js')
const depthPack = require('./depth-pack.glsl.js')

const sky = require('./sky.glsl.js')
const fog = require('./fog.glsl.js')
const tonemapUncharted2 = require('./tonemap-uncharted2.glsl.js')
const fxaa = require('./fxaa.glsl.js')

module.exports = {
  math,

  encodeDecode,
  rgbm,
  gamma,

  lightAmbient,
  lightDirectional,
  lightPoint,
  lightSpot,
  lightArea,
  shadowing,
  brdf,
  clearCoat,
  irradiance,
  direct,
  indirect,

  envMapEquirect,
  octMap,
  octMapUvToDir,

  textureCoordinates,
  baseColor,
  tintColor,
  emissiveColor,
  alpha,
  ambientOcclusion,
  normal,

  metallicRoughness,
  specularGlossiness,

  depthRead,
  depthUnpack,
  depthPack,

  sky,
  fog,
  tonemapUncharted2,
  fxaa
}
