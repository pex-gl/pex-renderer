const math = require('./chunks/math.glsl.js')
const encoding = require('./chunks/encoding.glsl.js')

const lights = require('./chunks/lights/index.js')
const shadowing = require('./chunks/shadowing.glsl.js')
const brdf = require('./chunks/brdf.glsl.js')
const irradiance = require('./chunks/irradiance.glsl.js')
const indirect = require('./chunks/indirect.glsl.js')

const envMapEquirect = require('./chunks/env-map-equirect.glsl.js')
const octMap = require('./chunks/oct-map.glsl.js')
const octMapUvToDir = require('./chunks/oct-map-uv-to-dir.glsl.js')

const baseColor = require('./chunks/base-color.glsl.js')
const emmisive = require('./chunks/emmisive.glsl.js')
const alpha = require('./chunks/alpha.glsl.js')
const ambientOcclusion = require('./chunks/ambient-occlusion.glsl.js')
const normals = require('./chunks/normals.glsl.js')

const workflowRoughnessMetallic = require('./chunks/workflow-roughness-metallic.glsl.js')
const workflowSpecularGlossiness = require('./chunks/workflow-specular-glossiness.glsl.js')

const depthUnpack = require('./chunks/depth-unpack.glsl.js')
const depthPack = require('./chunks/depth-pack.glsl.js')

const sky = require('./chunks/sky.glsl.js')
const fog = require('./chunks/fog.glsl.js')
const tonemapUncharted2 = require('./chunks/tonemap-uncharted2.glsl.js')
const fxaa = require('./chunks/fxaa.glsl.js')

module.exports = {
  math,
  encoding,

  lights,
  shadowing,
  brdf,
  irradiance,
  indirect,

  envMapEquirect,
  octMap,
  octMapUvToDir,

  baseColor,
  emmisive,
  alpha,
  ambientOcclusion,
  normals,

  workflowRoughnessMetallic,
  workflowSpecularGlossiness,

  depthUnpack,
  depthPack,

  sky,
  fog,
  tonemapUncharted2,
  fxaa
}
